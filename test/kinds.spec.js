import { describe, it, expect } from 'vitest';
import {
  classifyEvent,
  extractEventMetadata,
  extractRating,
  getKindLabel,
  CATEGORIES_CONFIG
} from '../src/kinds.js';

describe('kinds classification engine', () => {
  it('defines categories config with subfilters', () => {
    expect(CATEGORIES_CONFIG.length).toBeGreaterThan(5);
    const booksConfig = CATEGORIES_CONFIG.find((c) => c.id === 'books');
    expect(booksConfig).toBeDefined();
    expect(booksConfig.subFilters.map((s) => s.id)).toContain('reading');
    expect(booksConfig.subFilters.map((s) => s.id)).toContain('read');
    expect(booksConfig.subFilters.map((s) => s.id)).toContain('to-read');
    expect(booksConfig.subFilters.map((s) => s.id)).toContain('rated');

    const moviesConfig = CATEGORIES_CONFIG.find((c) => c.id === 'movies');
    expect(moviesConfig).toBeDefined();
    expect(moviesConfig.subFilters.map((s) => s.id)).toContain('watched');
    expect(moviesConfig.subFilters.map((s) => s.id)).toContain('rated');
    expect(moviesConfig.subFilters.map((s) => s.id)).toContain('watchlist');
  });

  describe('classifyEvent for Notes', () => {
    it('classifies root text note as notes:posts', () => {
      const event = {
        kind: 1,
        content: 'Hello Nostr world!',
        tags: []
      };
      expect(classifyEvent(event)).toEqual({ category: 'notes', subCategory: 'posts' });
    });

    it('classifies reply note as notes:replies', () => {
      const event = {
        kind: 1,
        content: 'Great point!',
        tags: [['e', '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'notes', subCategory: 'replies' });
    });

    it('classifies Kind 1111 comment as notes:replies', () => {
      const event = {
        kind: 1111,
        content: 'Comment on article',
        tags: []
      };
      expect(classifyEvent(event)).toEqual({ category: 'notes', subCategory: 'replies' });
    });

    it('classifies Kind 6 / 16 as notes:reposts', () => {
      expect(classifyEvent({ kind: 6, tags: [] })).toEqual({ category: 'notes', subCategory: 'reposts' });
      expect(classifyEvent({ kind: 16, tags: [] })).toEqual({ category: 'notes', subCategory: 'reposts' });
    });
  });

  describe('classifyEvent for Articles', () => {
    it('classifies Kind 30023 by owner as articles:my', () => {
      const event = {
        kind: 30023,
        pubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
        content: '# Deep dive into Haskell and Nostr\n\nLong form text...',
        tags: [
          ['d', 'haskell-nostr-deep-dive'],
          ['title', 'Deep dive into Haskell and Nostr']
        ]
      };
      expect(classifyEvent(event)).toEqual({ category: 'articles', subCategory: 'my' });
    });

    it('classifies Kind 30023 by other authors as articles:liked', () => {
      const event = {
        kind: 30023,
        pubkey: '1111111111111111111111111111111111111111111111111111111111111111',
        content: 'PosterChanOS introduction...',
        tags: [
          ['d', 'posterchan-os'],
          ['title', 'Introducing PosterChanOS']
        ]
      };
      expect(classifyEvent(event)).toEqual({ category: 'articles', subCategory: 'liked' });
    });
  });

  describe('classifyEvent for Media', () => {
    it('classifies Kind 20 as media:photos', () => {
      expect(classifyEvent({ kind: 20, tags: [] })).toEqual({ category: 'media', subCategory: 'photos' });
    });

    it('classifies Kind 21 / 22 as media:videos', () => {
      expect(classifyEvent({ kind: 21, tags: [] })).toEqual({ category: 'media', subCategory: 'videos' });
      expect(classifyEvent({ kind: 22, tags: [] })).toEqual({ category: 'media', subCategory: 'videos' });
    });

    it('classifies Kind 1063 with image mime as media:photos', () => {
      const event = {
        kind: 1063,
        tags: [['m', 'image/jpeg'], ['url', 'https://example.com/photo.jpg']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'media', subCategory: 'photos' });
    });

    it('classifies Kind 1 with image URL and short caption as media:photos', () => {
      const event = {
        kind: 1,
        content: 'Sunset view https://example.com/sunset.jpg',
        tags: []
      };
      expect(classifyEvent(event)).toEqual({ category: 'media', subCategory: 'photos' });
    });
  });

  describe('classifyEvent for Bookstr & Books', () => {
    it('classifies Bookstr Kind 30040 and 30041 as books', () => {
      expect(classifyEvent({ kind: 30040, tags: [] })).toEqual({ category: 'books', subCategory: 'reading' });
      expect(classifyEvent({ kind: 30041, tags: [] })).toEqual({ category: 'books', subCategory: 'reading' });
    });

    it('classifies Kind 30001 with d:books-reading as books:reading', () => {
      const event = {
        kind: 30001,
        tags: [['d', 'books-reading'], ['title', 'Currently Reading']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'books', subCategory: 'reading' });
    });

    it('classifies Kind 30001 with d:books-read as books:read', () => {
      const event = {
        kind: 30001,
        tags: [['d', 'books-read'], ['title', 'Finished Books']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'books', subCategory: 'read' });
    });

    it('classifies Kind 30001 with d:books-to-read as books:to-read', () => {
      const event = {
        kind: 30001,
        tags: [['d', 'books-to-read'], ['title', 'Want to Read']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'books', subCategory: 'to-read' });
    });

    it('classifies Kind 1985 review with isbn tag as books:rated', () => {
      const event = {
        kind: 1985,
        content: 'Great book! ★★★★★',
        tags: [['t', 'book'], ['isbn', '9780141439518'], ['rating', '5', '5']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'books', subCategory: 'rated' });
    });

    it('classifies Kind 31985 parameterized review with Goodreads content and isbn as books:rated', () => {
      const event = {
        kind: 31985,
        content: 'Rated 5/5 stars for "Othello" by William Shakespeare. Migrated from Goodreads via x2nostr.',
        tags: [
          ['d', 'goodreads:12345'],
          ['l', '1.0', 'rating'],
          ['isbn', '9789944884518'],
          ['isbn', '9789944884518']
        ]
      };
      expect(classifyEvent(event)).toEqual({ category: 'books', subCategory: 'rated' });

      const meta = extractEventMetadata(event);
      expect(meta.category).toBe('books');
      expect(meta.subCategory).toBe('rated');
      expect(meta.title).toBe('Othello');
      expect(meta.author).toBe('William Shakespeare');
      expect(meta.rating).toBe(5);
      expect(meta.isbn).toBe('9789944884518');
      expect(meta.image).toBe('https://covers.openlibrary.org/b/isbn/9789944884518-M.jpg');
      expect(meta.externalUrl).toBe('https://bookstr.xyz/b/9789944884518');
    });

    it('correctly normalizes NIP-32 float ratings (e.g. 1.0 -> 5.0, 0.8 -> 4.0)', () => {
      expect(extractRating([['l', '1.0', 'rating']])).toBe(5);
      expect(extractRating([['l', '0.8', 'rating']])).toBe(4);
      expect(extractRating([['l', '0.6', 'rating']])).toBe(3);
      expect(extractRating([['rating', '1.0']])).toBe(5);
      expect(extractRating([['rating', '4.5']])).toBe(4.5);
      expect(extractRating([], 'Rated 5/5 stars for "Toz Gibi Yıldızlar" by Isaac Asimov.')).toBe(5);
    });
  });

  describe('classifyEvent for Movies', () => {
    it('classifies Kind 30001 with d:movies-watched as movies:watched', () => {
      const event = {
        kind: 30001,
        tags: [['d', 'movies-watched'], ['title', 'Watched Movies']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'movies', subCategory: 'watched' });
    });

    it('classifies Kind 30001 with d:movies-watchlist as movies:watchlist', () => {
      const event = {
        kind: 30001,
        tags: [['d', 'movies-watchlist'], ['title', 'Movie Watchlist']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'movies', subCategory: 'watchlist' });
    });

    it('classifies movie review event with rating as movies:rated', () => {
      const event = {
        kind: 1985,
        content: 'Masterpiece film. Rating: 9/10',
        tags: [['t', 'movie'], ['imdb', 'tt0111161'], ['rating', '9', '10']]
      };
      expect(classifyEvent(event)).toEqual({ category: 'movies', subCategory: 'rated' });
    });

    it('classifies Kind 31985 Letterboxd movie review as movies:rated', () => {
      const event = {
        kind: 31985,
        content: 'Rated 4/5 stars for "Interstellar" (2014) by Christopher Nolan. Migrated from Letterboxd via x2nostr.',
        tags: [
          ['d', 'letterboxd:interstellar'],
          ['l', '0.8', 'rating'],
          ['imdb', 'tt0816692']
        ]
      };
      expect(classifyEvent(event)).toEqual({ category: 'movies', subCategory: 'rated' });

      const meta = extractEventMetadata(event);
      expect(meta.category).toBe('movies');
      expect(meta.subCategory).toBe('rated');
      expect(meta.title).toBe('Interstellar');
      expect(meta.year).toBe('2014');
      expect(meta.author).toBe('Christopher Nolan');
      expect(meta.rating).toBe(4);
      expect(meta.imdb).toBe('tt0816692');
      expect(meta.image).toBe('https://images.metahub.space/poster/medium/tt0816692/img.jpg');
    });
  });

  describe('classifyEvent for Lists & Highlights', () => {
    it('classifies Kind 30000 / 10000 as lists:people', () => {
      expect(classifyEvent({ kind: 30000, tags: [] })).toEqual({ category: 'lists', subCategory: 'people' });
    });

    it('classifies Kind 10003 / 30001 / 30003 as lists:bookmarks', () => {
      expect(classifyEvent({ kind: 10003, tags: [] })).toEqual({ category: 'lists', subCategory: 'bookmarks' });
    });

    it('classifies Kind 10073 / 10074 as lists', () => {
      expect(classifyEvent({ kind: 10073, tags: [] })).toEqual({ category: 'lists', subCategory: 'all' });
      expect(classifyEvent({ kind: 10074, tags: [] })).toEqual({ category: 'lists', subCategory: 'all' });
    });

    it('classifies Kind 9802 as highlights:quote', () => {
      expect(classifyEvent({ kind: 9802, tags: [] })).toEqual({ category: 'highlights', subCategory: 'quote' });
    });
  });

  describe('getKindLabel', () => {
    it('returns human-readable names for specific and non-standard kinds', () => {
      expect(getKindLabel(1)).toBe('💬 Note');
      expect(getKindLabel(10074)).toBe('🌸 Blossom Servers');
      expect(getKindLabel(10073)).toBe('🎙️ Media Relays');
      expect(getKindLabel(30617)).toBe('💻 Git Repository (NIP-34)');
      expect(getKindLabel(30618)).toBe('📦 Repository State (NIP-34)');
      expect(getKindLabel(10002)).toBe('📡 Relay List (NIP-65)');
    });
  });

  describe('extractEventMetadata', () => {
    it('extracts metadata and links owner articles to blog.emre.xyz', () => {
      const event = {
        kind: 30023,
        pubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
        tags: [
          ['d', 'building-on-nostr'],
          ['title', 'Building on Nostr'],
          ['summary', 'An overview of decentralized protocols.'],
          ['image', 'https://example.com/cover.png']
        ],
        content: 'Long article content...'
      };

      const meta = extractEventMetadata(event);
      expect(meta.category).toBe('articles');
      expect(meta.title).toBe('Building on Nostr');
      expect(meta.summary).toBe('An overview of decentralized protocols.');
      expect(meta.image).toBe('https://example.com/cover.png');
      expect(meta.externalUrl).toBe('https://blog.emre.xyz/building-on-nostr');
    });

    it('links third-party / liked articles to habla.news or njump.me and never to blog.emre.xyz', () => {
      const thirdPartyPubkey = '1111111111111111111111111111111111111111111111111111111111111111';
      const event = {
        id: 'article_999',
        kind: 30023,
        pubkey: thirdPartyPubkey,
        tags: [
          ['d', 'posterchan-os'],
          ['title', 'Introducing PosterChanOS']
        ],
        content: 'PosterChanOS content...'
      };

      const meta = extractEventMetadata(event);
      expect(meta.category).toBe('articles');
      expect(meta.externalUrl).toContain('habla.news');
      expect(meta.externalUrl).not.toContain('blog.emre.xyz');
    });

    it('extracts rating and metadata for movie reviews', () => {
      const event = {
        kind: 1985,
        content: 'Inception was mindblowing! Rating: 5/5',
        tags: [
          ['title', 'Inception'],
          ['poster', 'https://example.com/inception.jpg'],
          ['year', '2010'],
          ['imdb', 'tt1375666'],
          ['rating', '5', '5'],
          ['t', 'movie']
        ]
      };

      const meta = extractEventMetadata(event);
      expect(meta.category).toBe('movies');
      expect(meta.subCategory).toBe('rated');
      expect(meta.title).toBe('Inception');
      expect(meta.year).toBe('2010');
      expect(meta.imdb).toBe('tt1375666');
      expect(meta.rating).toBe(5);
      expect(meta.externalUrl).toBe('https://www.imdb.com/title/tt1375666');
    });

    it('extracts multiple movie items from movie list events', () => {
      const event = {
        kind: 30001,
        tags: [
          ['d', 'movies-favorites'],
          ['title', 'Favorite Sci-Fi Movies'],
          ['i', 'imdb:tt0133093', 'The Matrix', 'https://example.com/matrix.jpg'],
          ['i', 'tmdb:157336', 'Interstellar'],
          ['imdb', 'tt0062622', '2001: A Space Odyssey']
        ]
      };

      const meta = extractEventMetadata(event);
      expect(meta.category).toBe('movies');
      expect(meta.itemCount).toBe(3);
      expect(meta.items[0]).toEqual({
        type: 'imdb',
        raw: 'imdb:tt0133093',
        value: 'tt0133093',
        title: 'The Matrix',
        posterUrl: 'https://example.com/matrix.jpg',
        imdbUrl: 'https://www.imdb.com/title/tt0133093'
      });
      expect(meta.items[1]).toEqual({
        type: 'tmdb',
        raw: 'tmdb:157336',
        value: '157336',
        title: 'Interstellar',
        posterUrl: null,
        tmdbUrl: 'https://www.themoviedb.org/movie/157336'
      });
      expect(meta.items[2]).toEqual({
        type: 'imdb',
        raw: 'tt0062622',
        value: 'tt0062622',
        title: '2001: A Space Odyssey',
        posterUrl: 'https://images.metahub.space/poster/medium/tt0062622/img.jpg',
        imdbUrl: 'https://www.imdb.com/title/tt0062622'
      });
    });

    it('classifies Kind 3 follow list as lists:people', () => {
      const event = {
        kind: 3,
        tags: [
          ['p', '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2']
        ]
      };
      expect(classifyEvent(event)).toEqual({ category: 'lists', subCategory: 'people' });
    });

    it('extracts appContext for Kind 30078 app data', () => {
      const event = {
        kind: 30078,
        tags: [
          ['d', 'ditto:metadata'],
          ['title', 'Ditto Metadata']
        ],
        content: 'AvBNOIR0iO2y6/H81YQW6dwuOIuq+rnWN+Ljn9bx5EL1IUEezmgr9Ubn7sEt1QIgXIOPzX1X'
      };
      const meta = extractEventMetadata(event);
      expect(meta.appContext).toBeDefined();
      expect(meta.appContext.isAppData).toBe(true);
      expect(meta.appContext.appName).toBe('Ditto');
      expect(meta.appContext.isEncryptedOrRaw).toBe(true);
    });

    it('extracts labelContext and GitHub target for Kind 1985 review', () => {
      const event = {
        kind: 1985,
        tags: [
          ['L', 'nip'],
          ['l', 'approved', 'nip'],
          ['i', 'https://github.com/nostr-protocol/nips/blob/master/C0.md']
        ]
      };
      const meta = extractEventMetadata(event);
      expect(meta.labelContext).toBeDefined();
      expect(meta.labelContext.isLabelOrReview).toBe(true);
      expect(meta.labelContext.target.type).toBe('github');
      expect(meta.labelContext.target.repo).toBe('nostr-protocol/nips');
      expect(meta.labelContext.target.fileName).toBe('C0.md');
      expect(meta.labelContext.labels[0].value).toBe('approved');
    });

    it('extracts repoContext for comments referencing GitHub repo', () => {
      const event = {
        kind: 1,
        content: 'I was planning to start this type of project.',
        tags: [
          ['r', 'https://github.com/owner/cool-repo']
        ]
      };
      const meta = extractEventMetadata(event);
      expect(meta.repoContext).toBeDefined();
      expect(meta.repoContext.type).toBe('github');
      expect(meta.repoContext.repo).toBe('owner/cool-repo');
      expect(meta.repoContext.name).toBe('owner/cool-repo');
    });

    it('extracts gitContext and generates gitworkshop links for NIP-34 Git events', () => {
      const repoPubkey = '781a1527055f74c1f70230f10384609b34548f8ab6a0a6caa74025827f9fdae5';
      const event = {
        id: '98ff1e09e02bc7420e39d714290898c92c6ebe6b',
        pubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
        kind: 1618,
        content: 'git Pull Request: Turkish translations added for UI\n\nas nostr.org.tr developer...',
        tags: [
          ['a', `30617:${repoPubkey}:ditto`],
          ['commit', '98ff1e09e02bc7420e39d714290898c92c6ebe6b']
        ]
      };
      const meta = extractEventMetadata(event);
      expect(meta.gitContext).toBeDefined();
      expect(meta.gitContext.isGit).toBe(true);
      expect(meta.gitContext.repoName).toBe('ditto');
      expect(meta.gitContext.subject).toBe('Turkish translations added for UI');
      expect(meta.gitContext.gitworkshopUrl).toContain('gitworkshop.dev/r/');
      expect(meta.gitContext.gitworkshopUrl).toContain('/pulls/98ff1e09e02bc7420e39d714290898c92c6ebe6b');
      expect(meta.gitContext.commitBadges[0].shortHash).toBe('98ff1e0');
    });

    it('extracts appHandlerContext and generates nostrhub link for Kind 31990', () => {
      const event = {
        id: 'app_evt_1',
        pubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
        kind: 31990,
        tags: [
          ['d', '5wo5lk0l'],
          ['k', '1337']
        ],
        content: JSON.stringify({
          name: 'Snippets',
          about: 'An open-source, decentralized code snippet sharing platform',
          picture: 'https://blossom.primal.net/img.png',
          website: 'https://snips.emre.xyz',
          nip05: 'delirehberi@emre.xyz'
        })
      };
      const meta = extractEventMetadata(event);
      expect(meta.appHandlerContext).toBeDefined();
      expect(meta.appHandlerContext.name).toBe('Snippets');
      expect(meta.appHandlerContext.website).toBe('https://snips.emre.xyz');
      expect(meta.appHandlerContext.nostrhubUrl).toContain('https://nostrhub.io/a/');
      expect(meta.appHandlerContext.supportedKinds).toContain(1337);
    });

    it('extracts snippetContext and generates snips.emre.xyz link for Kind 1337', () => {
      const event = {
        id: '3092759dac162b55606ba8339ce1400cf62a0fc1e45d6e3d1d2e0a831d0e59cd',
        kind: 1337,
        content: 'print("hello")',
        tags: [
          ['title', 'rotatevideo.ipynb'],
          ['l', 'python']
        ]
      };
      const meta = extractEventMetadata(event);
      expect(meta.snippetContext).toBeDefined();
      expect(meta.snippetContext.title).toBe('rotatevideo.ipynb');
      expect(meta.snippetContext.language).toBe('python');
      expect(meta.snippetContext.snipsUrl).toBe('https://snips.emre.xyz/#/s/3092759dac162b55606ba8339ce1400cf62a0fc1e45d6e3d1d2e0a831d0e59cd');
    });

    it('extracts reactionContext for Kind 7 reactions', () => {
      const event = {
        id: 'reaction_1',
        kind: 7,
        content: '+',
        tags: [
          ['e', '909b685cf263c6547bbced5dbc58fd5954f7e1c9368d1ec1d70190278a5a3343'],
          ['p', '781a1527055f74c1f70230f10384609b34548f8ab6a0a6caa74025827f9fdae5'],
          ['a', '30617:781a1527055f74c1f70230f10384609b34548f8ab6a0a6caa74025827f9fdae5:ditto']
        ]
      };
      const meta = extractEventMetadata(event);
      expect(meta.reactionContext).toBeDefined();
      expect(meta.reactionContext.reaction).toBe('+');
      expect(meta.reactionContext.targetEventId).toBe('909b685cf263c6547bbced5dbc58fd5954f7e1c9368d1ec1d70190278a5a3343');
    });

    it('extracts quotes from note content and tags', () => {
      const event = {
        id: 'note_with_quote',
        kind: 1,
        content: 'Check out this note: nostr:note1z940y6x2570n8fau900k7t5j3r6zfq60h8xuv809l93y2s247e6seepupz\nAlso see [event:note1z940y6x2570n8fau900k7t5j3r6zfq60h8xuv809l93y2s247e6seepupz]',
        tags: [
          ['q', 'target_quote_id']
        ]
      };
      const meta = extractEventMetadata(event);
      expect(meta.quotes).toBeDefined();
      expect(meta.quotes.length).toBeGreaterThan(0);
      expect(meta.quotes.some((q) => q.id === 'target_quote_id')).toBe(true);
    });
  });
});


