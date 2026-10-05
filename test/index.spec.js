import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index.js';

const env = (response) => ({ ASSETS: { fetch: vi.fn().mockResolvedValue(response) } });

describe('nostr client worker & static asset handler', () => {
  it('serves static assets via env.ASSETS', async () => {
    const asset = new Response('SPA HTML', { headers: { 'Content-Type': 'text/html' } });
    const mockEnv = env(asset);
    const request = new Request('http://example.com/');
    const response = await worker.fetch(request, mockEnv);
    expect(mockEnv.ASSETS.fetch).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe('SPA HTML');
  });

  it('caches hashed assets forever and makes HTML revalidate', async () => {
    const js = await worker.fetch(
      new Request('http://example.com/assets/index-abc123.js'),
      env(new Response('x', { headers: { 'Content-Type': 'text/javascript' } }))
    );
    expect(js.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');

    const html = await worker.fetch(
      new Request('http://example.com/'),
      env(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }))
    );
    expect(html.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('does not cache the SPA fallback for a missing /assets/ file as immutable', async () => {
    const response = await worker.fetch(
      new Request('http://example.com/assets/missing.js'),
      env(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }))
    );
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('adds security headers and preserves status', async () => {
    const response = await worker.fetch(
      new Request('http://example.com/nope'),
      env(new Response('nf', { status: 404, headers: { 'Content-Type': 'text/html' } }))
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    const csp = response.headers.get('Content-Security-Policy-Report-Only');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('wss://cache.nostr.org.tr');
  });

  it('has no scheduled handler (the KV cache it purged is gone)', () => {
    expect(worker.scheduled).toBeUndefined();
  });

  it('returns fallback response when env.ASSETS is not available', async () => {
    const response = await worker.fetch(new Request('http://example.com/'), {});
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Nostr Client SPA');
  });
});
