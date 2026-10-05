import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTheme } from '../src/hooks/useTheme.js';
import { getFontFormat, generateThemeCss } from '../src/theme.js';
import { installMockWebSocket } from './helpers/mockWebSocket.js';

vi.mock('../src/eventValidation.js', () => ({ acceptEvent: () => true }));

afterEach(() => {
  vi.unstubAllGlobals();
  document.getElementById('nostr-dynamic-theme')?.remove();
});

const OWNER = 'a'.repeat(64);
const relays = ['wss://r'];

describe('useTheme', () => {
  it('resolves a kind 16767 that references a kind 36767 via an a tag', async () => {
    const active = { id: 'act', pubkey: OWNER, kind: 16767, created_at: 10, content: '', tags: [['a', `36767:${OWNER}:my-theme`]] };
    const definition = {
      id: 'def',
      pubkey: OWNER,
      kind: 36767,
      created_at: 5,
      content: '',
      tags: [['d', 'my-theme'], ['c', '#112233', 'background'], ['c', '#ffeedd', 'text'], ['c', '#ff0000', 'primary']],
    };
    installMockWebSocket((url, filter, ws) => {
      if (filter.kinds?.includes(16767)) ws.emit(['EVENT', ws.subId, active]);
      if (filter.kinds?.includes(36767) && filter['#d']?.[0] === 'my-theme') ws.emit(['EVENT', ws.subId, definition]);
      ws.emit(['EOSE', ws.subId]);
    });

    const { result, unmount } = renderHook(() => useTheme(OWNER, relays));
    await waitFor(() => expect(result.current?.background).toBe('#112233'));
    expect(document.getElementById('nostr-dynamic-theme').textContent).toContain('#112233');

    unmount();
    expect(document.getElementById('nostr-dynamic-theme')).toBeNull();
  });

  it('resolves an e tag reference by event id', async () => {
    const active = { id: 'act', pubkey: OWNER, kind: 16767, created_at: 10, content: '', tags: [['e', 'def']] };
    const definition = { id: 'def', pubkey: OWNER, kind: 36767, created_at: 5, content: '', tags: [['c', '#000000', 'background']] };
    installMockWebSocket((url, filter, ws) => {
      if (filter.kinds?.includes(16767)) ws.emit(['EVENT', ws.subId, active]);
      if (filter.ids?.includes('def')) ws.emit(['EVENT', ws.subId, definition]);
      ws.emit(['EOSE', ws.subId]);
    });
    const { result } = renderHook(() => useTheme(OWNER, relays));
    await waitFor(() => expect(result.current?.background).toBe('#000000'));
  });
});

describe('font format', () => {
  it('infers the format from the URL extension', () => {
    expect(getFontFormat('https://x.com/f.woff2')).toBe('woff2');
    expect(getFontFormat('https://x.com/f.woff?v=1')).toBe('woff');
    expect(getFontFormat('https://x.com/f.TTF')).toBe('truetype');
    expect(getFontFormat('https://x.com/f.otf')).toBe('opentype');
    expect(getFontFormat('https://x.com/font')).toBeNull();
  });

  it('only emits a format() hint when it is known', () => {
    const css = generateThemeCss({
      background: '#fff',
      text: '#000',
      primary: '#00f',
      fonts: [
        { family: 'A', url: 'https://x.com/a.woff', role: 'body' },
        { family: 'B', url: 'https://x.com/b', role: 'title' },
      ],
    });
    expect(css).toContain('url("https://x.com/a.woff") format("woff")');
    expect(css).toContain('url("https://x.com/b");');
    expect(css).not.toContain('format("woff2")');
  });
});
