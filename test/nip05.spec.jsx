import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import worker from '../src/index.js';
import { parseNip05, nostrJsonMatches } from '../src/nip05.js';
import { ProfileAvatar } from '../src/components/ProfileAvatar.jsx';

const PUBKEY = '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a';
const OTHER = 'a'.repeat(64);

afterEach(() => vi.unstubAllGlobals());

describe('parseNip05', () => {
  it('splits name and domain, defaulting to _', () => {
    expect(parseNip05('Emre@Emre.xyz')).toEqual({ name: 'emre', domain: 'emre.xyz' });
    expect(parseNip05('emre.xyz')).toEqual({ name: '_', domain: 'emre.xyz' });
  });

  it('rejects IPs, ports, paths and bare hosts', () => {
    ['a@127.0.0.1', 'a@localhost', 'a@example.com:8080', 'a@example.com/x', 'a b@example.com', '', null].forEach((v) =>
      expect(parseNip05(v)).toBeNull()
    );
  });
});

describe('nostrJsonMatches', () => {
  it('requires the exact pubkey for the name', () => {
    expect(nostrJsonMatches({ names: { a: PUBKEY } }, 'a', PUBKEY)).toBe(true);
    expect(nostrJsonMatches({ names: { a: PUBKEY.toUpperCase() } }, 'a', PUBKEY)).toBe(true);
    expect(nostrJsonMatches({ names: { a: OTHER } }, 'a', PUBKEY)).toBe(false);
    expect(nostrJsonMatches({ names: {} }, 'a', PUBKEY)).toBe(false);
    expect(nostrJsonMatches({ names: { a: PUBKEY } }, 'toString', PUBKEY)).toBe(false);
    expect(nostrJsonMatches(null, 'a', PUBKEY)).toBe(false);
  });
});

describe('worker /api/nip05', () => {
  const call = async (id, pubkey = PUBKEY, method = 'GET') =>
    worker.fetch(
      new Request(`https://nostr.emre.xyz/api/nip05?id=${encodeURIComponent(id)}&pubkey=${pubkey}`, { method }),
      {}
    );

  it('verifies against the identity server without following redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ names: { emre: PUBKEY } })));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call('emre@example.com');
    expect(await res.json()).toEqual({ verified: true });
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/.well-known/nostr.json?name=emre');
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('is not verified when the pubkey differs, the request fails, or the id is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ names: { emre: OTHER } }))));
    expect(await (await call('emre@example.com')).json()).toEqual({ verified: false });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await (await call('emre@example.com')).json()).toEqual({ verified: false });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await (await call('emre@127.0.0.1')).json()).toEqual({ verified: false });
    expect(await (await call('emre@example.com', 'nothex')).json()).toEqual({ verified: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats redirect and error responses as unverified, and only allows GET', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302 })));
    expect(await (await call('emre@example.com')).json()).toEqual({ verified: false });
    expect((await call('emre@example.com', PUBKEY, 'POST')).status).toBe(405);
  });
});

describe('ProfileAvatar NIP-05', () => {
  const renderWith = (nip05) =>
    render(<ProfileAvatar pubkey={PUBKEY} profileMap={new Map([[PUBKEY, { name: 'Emre', nip05 }]])} />);

  it('shows the identifier with a check only after verification succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ verified: true }))));
    renderWith('verified@example.com');
    expect(screen.queryByText(/verified@example.com/)).toBeNull();
    await waitFor(() => expect(screen.getByText('✓ verified@example.com')).toBeDefined());
  });

  it('hides an unverified identifier', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ verified: false })));
    vi.stubGlobal('fetch', fetchMock);
    renderWith('fake@example.org');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/fake@example.org/)).toBeNull();
  });
});
