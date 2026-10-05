import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProfiles } from '../src/hooks/useProfiles.js';
import { installMockWebSocket } from './helpers/mockWebSocket.js';

// Signature checks are covered in relayClient.spec.js
vi.mock('../src/eventValidation.js', () => ({ acceptEvent: () => true }));

afterEach(() => {
  vi.unstubAllGlobals();
});

const pk = (i) => String(i).padStart(64, '0');

describe('useProfiles', () => {
  it('requests every pubkey, splitting into batches of at most 50 authors', async () => {
    const requested = [];
    installMockWebSocket((url, filter, ws) => {
      requested.push(filter.authors.length);
      filter.authors.forEach((a) =>
        ws.emit([
          'EVENT',
          ws.subId,
          { id: `id-${a}`, pubkey: a, kind: 0, created_at: 1, tags: [], content: JSON.stringify({ name: `n${a.slice(-3)}` }) },
        ])
      );
      ws.emit(['EOSE', ws.subId]);
    });

    const relays = ['wss://r'];
    const { result } = renderHook(() => useProfiles(relays));
    const all = Array.from({ length: 120 }, (_, i) => pk(i + 1));
    act(() => result.current.requestProfiles(all));

    await waitFor(() => expect(result.current.profileMap.size).toBe(120));
    expect(requested.sort((a, b) => b - a)).toEqual([50, 50, 20]);
  });

  it('retries pubkeys after a relay failure', async () => {
    let attempts = 0;
    installMockWebSocket((url, filter, ws) => {
      attempts += 1;
      if (attempts === 1) {
        ws.close(); // first attempt fails without EOSE
        return;
      }
      ws.emit([
        'EVENT',
        ws.subId,
        { id: 'e1', pubkey: pk(1), kind: 0, created_at: 1, tags: [], content: '{"name":"alice"}' },
      ]);
      ws.emit(['EOSE', ws.subId]);
    });

    const relays = ['wss://r'];
    const { result } = renderHook(() => useProfiles(relays));
    act(() => result.current.requestProfiles([pk(1)]));
    await waitFor(() => expect(attempts).toBe(1));
    await new Promise((r) => setTimeout(r, 20));
    act(() => result.current.requestProfiles([pk(1)]));
    await waitFor(() => expect(result.current.profileMap.get(pk(1))?.name).toBe('alice'));
  });
});
