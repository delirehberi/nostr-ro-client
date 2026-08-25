import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';
import { renderHomePage, renderPostPage } from '../src/views.js';
import { parseThemeEvent, generateThemeCss } from '../src/theme.js';

describe('nostr SSR and worker', () => {
  const mockTheme = {
    background: '#1c1515',
    text: '#ffffff',
    primary: '#ee5b2b',
    fonts: [
      {
        family: 'Lora',
        url: 'https://cdn.jsdelivr.net/fontsource/fonts/lora:vf@latest/latin-wght-normal.woff2',
        role: 'body'
      },
      {
        family: 'Lora',
        url: 'https://cdn.jsdelivr.net/fontsource/fonts/lora:vf@latest/latin-wght-normal.woff2',
        role: 'title'
      }
    ],
    title: 'Profile Theme'
  };

  it('renders homepage HTML with theme CSS and fonts', () => {
    const mainEventIds = ['note1'];
    const eventMap = new Map([
      [
        'note1',
        {
          id: 'note1',
          pubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
          content: 'Testing Nostr custom themes!',
          created_at: 1787317306,
          tags: []
        }
      ]
    ]);
    const profileMap = new Map([
      [
        '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
        { name: 'delirehberi', display_name: 'Emre Yilmaz' }
      ]
    ]);

    const html = String(renderHomePage(mainEventIds, eventMap, profileMap, mockTheme));

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('--bg: #1c1515');
    expect(html).toContain('--text: #ffffff');
    expect(html).toContain('--primary: #ee5b2b');
    expect(html).toContain('@font-face');
    expect(html).toContain('Lora');
    expect(html).toContain('Testing Nostr custom themes!');
    expect(html).toContain('delirehberi');
  });

  it('renders post page HTML with theme', () => {
    const eventMap = new Map([
      [
        'note1',
        {
          id: 'note1',
          pubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
          content: 'Individual note page test',
          created_at: 1787317306,
          tags: []
        }
      ]
    ]);
    const profileMap = new Map();

    const html = String(renderPostPage('note1', eventMap, profileMap, mockTheme));

    expect(html).toContain('--bg: #1c1515');
    expect(html).toContain('Individual note page test');
    expect(html).toContain('https://cdn.jsdelivr.net/fontsource/fonts/lora:vf@latest/latin-wght-normal.woff2');
  });

  it('serves cached homepage when present in KV', async () => {
    const cachedContent = '<html><body>Cached Homepage with Theme</body></html>';
    await env.CACHE.put('homepage', cachedContent);

    const request = new Request('http://example.com/');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe(cachedContent);
  });

  it('handles scheduled cache purge', async () => {
    await env.CACHE.put('homepage', 'old-content');
    await worker.scheduled({}, env);
    const cached = await env.CACHE.get('homepage');
    expect(cached).toBeNull();
  });
});
