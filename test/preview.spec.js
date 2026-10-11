// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/index.js';
import { buildPreview, injectPreview } from '../src/preview.js';
import { OWNER_PUBKEY } from '../src/config.js';

// Signature checking has its own tests; here every well-formed event passes.
vi.mock('../src/eventValidation.js', () => ({
  acceptEvent: (e, f = {}) => !!e && (!f.ids || f.ids.includes(e.id)),
}));

afterEach(() => vi.unstubAllGlobals());

const ID = 'a'.repeat(64);
const HTML =
  '<!DOCTYPE html><html><head><title>My Nostr Hub | @delirehberi</title></head><body><div id="root"></div></body></html>';
const post = (over = {}) => ({
  id: ID,
  pubkey: OWNER_PUBKEY,
  kind: 1,
  created_at: 100,
  tags: [],
  content: 'Hello Nostr. This is my first post https://example.com/x',
  ...over,
});

/** Fake relay answering a REQ with `frames` through a Workers-style `res.webSocket`. */
function stubRelays(frames) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => {
      const listeners = {};
      const ws = {
        accept() {},
        close() {},
        addEventListener(type, fn) {
          listeners[type] = fn;
        },
        send(raw) {
          const subId = JSON.parse(raw)[1];
          queueMicrotask(() => frames(subId).forEach((f) => listeners.message({ data: JSON.stringify(f) })));
        },
      };
      return { webSocket: ws };
    })
  );
}

const asset = () => ({ ASSETS: { fetch: vi.fn().mockResolvedValue(new Response(HTML, { headers: { 'Content-Type': 'text/html' } })) } });
const get = (path, env = asset()) => worker.fetch(new Request(`https://nostr.emre.xyz${path}`), env);

describe('buildPreview', () => {
  it('builds title, description and image from the post', () => {
    const preview = buildPreview(post({ content: 'Look at this. https://img.example/a.png more text' }));
    expect(preview.title).toBe('Look at this.');
    expect(preview.description).toBe('Look at this. more text');
    expect(preview.image).toBe('https://img.example/a.png');
  });

  it('prefers imeta images and ignores non-https ones', () => {
    expect(buildPreview(post({ tags: [['imeta', 'url https://cdn.example/p.jpg', 'm image/jpeg']] })).image).toBe(
      'https://cdn.example/p.jpg'
    );
    expect(buildPreview(post({ content: 'x http://insecure.example/a.png' })).image).toBeNull();
  });

  it('refuses events from other authors and private kinds', () => {
    expect(buildPreview(post({ pubkey: 'b'.repeat(64) }))).toBeNull();
    expect(buildPreview(post({ kind: 4 }))).toBeNull();
    expect(buildPreview(null)).toBeNull();
  });

  it('truncates long text', () => {
    const preview = buildPreview(post({ content: 'word '.repeat(200) }));
    expect(preview.title.length).toBeLessThanOrEqual(70);
    expect(preview.description.length).toBeLessThanOrEqual(200);
  });
});

describe('injectPreview', () => {
  it('escapes injected text and keeps $ sequences literal', () => {
    const html = injectPreview(HTML, { title: '<script>x</script> "q" $&', description: "a' & b", image: null }, 'https://h/p/1');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt; &quot;q&quot; $&amp;');
    expect(html).toContain('a&#39; &amp; b');
    expect(html).toContain('twitter:card" content="summary"');
    expect(html.match(/<title>/g)).toHaveLength(1);
  });
});

describe('worker /p/<id> previews', () => {
  it('injects Open Graph tags for the owner’s post', async () => {
    stubRelays((subId) => [['EVENT', subId, post()], ['EOSE', subId]]);
    const res = await get(`/p/${ID}`);
    const html = await res.text();
    expect(html).toContain('property="og:title" content="Hello Nostr."');
    expect(html).toContain(`property="og:url" content="https://nostr.emre.xyz/p/${ID}"`);
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('serves the plain page when no relay has the event', async () => {
    stubRelays((subId) => [['EOSE', subId]]);
    expect(await (await get(`/p/${ID}`)).text()).toBe(HTML);
  });

  it('serves the plain page for another author’s post, a bad id, or relay errors', async () => {
    stubRelays((subId) => [['EVENT', subId, post({ pubkey: 'b'.repeat(64) })], ['EOSE', subId]]);
    expect(await (await get(`/p/${ID}`)).text()).toBe(HTML);

    const fetchSpy = vi.fn().mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchSpy);
    expect(await (await get(`/p/${ID}`)).text()).toBe(HTML);
    expect(await (await get('/p/not-an-id')).text()).toBe(HTML);
  });

  it('does not look anything up for other paths', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await (await get('/')).text()).toBe(HTML);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gives up on a relay that never answers', async () => {
    vi.useFakeTimers();
    stubRelays(() => []);
    const pending = get(`/p/${ID}`);
    await vi.advanceTimersByTimeAsync(2500);
    expect(await (await pending).text()).toBe(HTML);
    vi.useRealTimers();
  });
});
