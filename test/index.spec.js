import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index.js';

describe('nostr client worker & static asset handler', () => {
  it('handles scheduled cache purge', async () => {
    const mockCache = {
      delete: vi.fn().mockResolvedValue(true),
    };
    const mockEnv = {
      CACHE: mockCache,
      PUBKEY: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
    };

    await worker.scheduled({}, mockEnv);
    expect(mockCache.delete).toHaveBeenCalledWith('homepage:v5');
    expect(mockCache.delete).toHaveBeenCalledWith(`theme:${mockEnv.PUBKEY}`);
  });

  it('serves static assets via env.ASSETS', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('SPA HTML'));
    const mockEnv = {
      ASSETS: {
        fetch: mockFetch,
      },
    };

    const request = new Request('http://example.com/');
    const response = await worker.fetch(request, mockEnv);
    expect(mockFetch).toHaveBeenCalledWith(request);
    expect(response).toBeDefined();
  });

  it('returns fallback response when env.ASSETS is not available', async () => {
    const request = new Request('http://example.com/');
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('Nostr Client SPA');
  });
});
