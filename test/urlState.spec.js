import { describe, it, expect } from 'vitest';
import { nip19 } from 'nostr-tools';
import { decodePostId, parseLocation, buildFeedUrl } from '../src/urlState.js';

const hex = 'ab'.repeat(32);

describe('urlState', () => {
  it('decodes hex, note1 and nevent1 ids and rejects garbage', () => {
    expect(decodePostId(hex)).toBe(hex);
    expect(decodePostId(nip19.noteEncode(hex))).toBe(hex);
    expect(decodePostId(nip19.neventEncode({ id: hex }))).toBe(hex);
    expect(decodePostId('note1notvalid')).toBeNull();
    expect(decodePostId('hello')).toBeNull();
    expect(decodePostId(nip19.npubEncode(hex))).toBeNull();
  });

  it('parses feed locations and falls back for unknown values', () => {
    expect(parseLocation({ pathname: '/', search: '' })).toEqual({ view: 'feed', category: 'notes', sub: 'all' });
    expect(parseLocation({ pathname: '/', search: '?kind=books&sub=rated' })).toEqual({ view: 'feed', category: 'books', sub: 'rated' });
    expect(parseLocation({ pathname: '/', search: '?kind=foo&sub=bar' })).toEqual({ view: 'feed', category: 'notes', sub: 'all' });
    expect(parseLocation({ pathname: '/', search: '?kind=books&sub=posts' })).toEqual({ view: 'feed', category: 'books', sub: 'all' });
    expect(parseLocation({ pathname: '/', search: '?kind=all' })).toEqual({ view: 'feed', category: 'all', sub: 'all' });
  });

  it('parses post locations', () => {
    expect(parseLocation({ pathname: `/p/${hex}`, search: '' })).toEqual({ view: 'post', postId: hex });
    expect(parseLocation({ pathname: '/p/nope', search: '' })).toEqual({ view: 'post', postId: null });
  });

  it('builds feed URLs omitting defaults and round-trips them', () => {
    expect(buildFeedUrl('notes', 'all')).toBe('/');
    expect(buildFeedUrl('books', 'all')).toBe('/?kind=books');
    expect(buildFeedUrl('movies', 'rated')).toBe('/?kind=movies&sub=rated');
    const [path, search = ''] = buildFeedUrl('all', 'all').split('?');
    expect(parseLocation({ pathname: path, search: search && '?' + search })).toMatchObject({ category: 'all' });
  });
});
