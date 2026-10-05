import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const jsonResponse = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

describe('useBookMetadata', () => {
  it('retries after a failed request and then resolves the card', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(jsonResponse({ 'ISBN:111': { title: 'Dune', authors: [{ name: 'Frank Herbert' }], cover: { medium: 'https://c/x.jpg' } } }));
    vi.stubGlobal('fetch', fetchMock);

    const { useBookMetadata } = await import('../src/hooks/useBookMetadata.js');
    const { result } = renderHook(() => useBookMetadata('111'));

    await waitFor(() => expect(result.current.title).toBe('Dune'), { timeout: 4000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches unknown ISBNs so they are not requested again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    const { useBookMetadata } = await import('../src/hooks/useBookMetadata.js');
    const first = renderHook(() => useBookMetadata('999'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    first.unmount();
    await new Promise((r) => setTimeout(r, 50));

    renderHook(() => useBookMetadata('999'));
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('nostr_book_metadata_cache'))['999'].notFound).toBe(true);
  });

  it('does not request ISBNs whose component unmounted before the batch ran', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    const { useBookMetadata } = await import('../src/hooks/useBookMetadata.js');
    const { unmount } = renderHook(() => useBookMetadata('555'));
    unmount();
    await new Promise((r) => setTimeout(r, 300));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('metadataCache', () => {
  it('drops expired entries on load and caps what it persists', async () => {
    const { loadCache, saveCache, MAX_PERSISTED_ENTRIES, NOT_FOUND_TTL_MS } = await import('../src/hooks/metadataCache.js');
    const now = Date.now();
    localStorage.setItem(
      'k',
      JSON.stringify({
        fresh: { title: 'a', ts: now },
        staleMiss: { notFound: true, ts: now - NOT_FOUND_TTL_MS - 1000 },
      })
    );
    const map = loadCache('k');
    expect(Array.from(map.keys())).toEqual(['fresh']);

    const big = new Map();
    for (let i = 0; i < MAX_PERSISTED_ENTRIES + 50; i++) big.set(`id${i}`, { title: 't', ts: now + i });
    saveCache('k2', big);
    const saved = JSON.parse(localStorage.getItem('k2'));
    expect(Object.keys(saved)).toHaveLength(MAX_PERSISTED_ENTRIES);
    expect(saved[`id${MAX_PERSISTED_ENTRIES + 49}`]).toBeDefined(); // newest kept
    expect(saved.id0).toBeUndefined(); // oldest dropped
  });
});

describe('useMovieMetadata', () => {
  it('falls back from movie to series and caches the result', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('/meta/movie/')) return jsonResponse({}, 404);
      return jsonResponse({ meta: { name: 'Severance', poster: 'https://p/s.jpg', year: '2022', imdbRating: '8.7' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useMovieMetadata } = await import('../src/hooks/useMovieMetadata.js');
    const { result } = renderHook(() => useMovieMetadata('tt11280740'));
    await waitFor(() => expect(result.current.title).toBe('Severance'));
    expect(result.current.rating).toBeCloseTo(4.35);
    expect(JSON.parse(localStorage.getItem('nostr_movie_metadata_cache')).tt11280740.title).toBe('Severance');
  });

  it('retries on server errors instead of caching a miss', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValue(jsonResponse({ meta: { name: 'Heat', poster: 'https://p/h.jpg' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { useMovieMetadata } = await import('../src/hooks/useMovieMetadata.js');
    const { result } = renderHook(() => useMovieMetadata('tt0113277'));
    await waitFor(() => expect(result.current.title).toBe('Heat'), { timeout: 4000 });
  });
});
