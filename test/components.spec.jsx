import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimpleTextPostComponent } from '../src/components/SimpleTextPostComponent.jsx';
import { MovieComponent } from '../src/components/MovieComponent.jsx';
import { BookComponent } from '../src/components/BookComponent.jsx';
import { ArticleComponent } from '../src/components/ArticleComponent.jsx';
import { MediaComponent } from '../src/components/MediaComponent.jsx';
import { ListComponent } from '../src/components/ListComponent.jsx';
import { HighlightComponent } from '../src/components/HighlightComponent.jsx';
import { GenericComponent } from '../src/components/GenericComponent.jsx';
import { EventCard } from '../src/components/EventCard.jsx';
import { FilterBar } from '../src/components/FilterBar.jsx';
import { RatingStars } from '../src/components/RatingStars.jsx';

describe('React Component Suite', () => {
  const mockPubkey = '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a';
  const profileMap = new Map([
    [mockPubkey, { name: 'delirehberi', display_name: 'Emre Yilmaz', nip05: 'delirehberi@emre.xyz' }]
  ]);

  describe('RatingStars', () => {
    it('renders 5 star rating correctly', () => {
      const { container } = render(<RatingStars rating={4.5} />);
      expect(container.querySelector('.rating-badge')).toBeDefined();
      expect(container.textContent).toContain('4.5');
    });

    it('returns null when no rating provided', () => {
      const { container } = render(<RatingStars rating={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('SimpleTextPostComponent', () => {
    it('renders a root text note with author profile and content', () => {
      const event = {
        id: 'note_123',
        kind: 1,
        pubkey: mockPubkey,
        content: 'Hello Nostr from React!',
        created_at: 1787317300,
        tags: []
      };

      render(<SimpleTextPostComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Emre Yilmaz')).toBeDefined();
      expect(screen.getByText('delirehberi@emre.xyz')).toBeDefined();
      expect(screen.getByText('Hello Nostr from React!')).toBeDefined();
      expect(screen.getByText('share')).toBeDefined();
      expect(screen.getByText('relay link')).toBeDefined();
    });

    it('renders parent post context when replying', () => {
      const parentEvent = {
        id: 'parent_note_1',
        pubkey: mockPubkey,
        content: 'This is the parent question',
        created_at: 1787317200,
        tags: []
      };
      const eventMap = new Map([['parent_note_1', parentEvent]]);

      const replyEvent = {
        id: 'reply_1',
        kind: 1,
        pubkey: mockPubkey,
        content: 'This is the answer',
        created_at: 1787317300,
        tags: [['e', 'parent_note_1']]
      };

      render(<SimpleTextPostComponent event={replyEvent} profileMap={profileMap} eventMap={eventMap} />);
      expect(screen.getByText('This is the parent question')).toBeDefined();
      expect(screen.getByText('This is the answer')).toBeDefined();
      expect(screen.getByText('view original thread')).toBeDefined();
    });

    it('unpacks and renders a NIP-18 repost with stringified JSON event in content', () => {
      const originalAuthorPubkey = '21dc2de63b38fcf0e801eac4ca47c5b1a242f275971775059a1b2613e17972e1';
      const repostProfileMap = new Map([
        [mockPubkey, { name: 'delirehberi', display_name: 'Emre Yilmaz' }],
        [originalAuthorPubkey, { name: 'tugce', display_name: 'Tuğçe Şenoğul' }]
      ]);

      const innerEvent = {
        id: 'f48a4738db7f633559c9f1cd3d464578709bd93c6cc6ece3c2497e4e3f6dc353',
        pubkey: originalAuthorPubkey,
        kind: 1,
        created_at: 1786860046,
        tags: [],
        content: 'BAGIMSIZ MÜZİSYENLER RİSK ALTINDA! Tuğçe Şenoğul röportajı https://example.com/roportaj'
      };

      const repostEvent = {
        id: 'repost_123',
        kind: 6,
        pubkey: mockPubkey,
        content: JSON.stringify(innerEvent),
        created_at: 1786860100,
        tags: [
          ['e', innerEvent.id],
          ['p', originalAuthorPubkey]
        ]
      };

      const { container } = render(
        <SimpleTextPostComponent event={repostEvent} profileMap={repostProfileMap} />
      );

      // Reposter banner
      expect(screen.getByText(/Reposted by/)).toBeDefined();
      expect(screen.getByText(/Emre Yilmaz/)).toBeDefined();

      // Original author and content (no raw JSON!)
      expect(screen.getByText('Tuğçe Şenoğul')).toBeDefined();
      expect(screen.getByText(/BAGIMSIZ MÜZİSYENLER RİSK ALTINDA!/)).toBeDefined();
      expect(container.textContent).not.toContain('{"id":');
      expect(container.textContent).not.toContain('"pubkey":');
    });
  });

  describe('MovieComponent', () => {
    it('renders movie review with rating, year, director and IMDb link', () => {
      const event = {
        id: 'movie_rev_1',
        kind: 1985,
        pubkey: mockPubkey,
        content: 'Inception is phenomenal.',
        created_at: 1787317300,
        tags: [
          ['t', 'movie'],
          ['title', 'Inception'],
          ['year', '2010'],
          ['author', 'Christopher Nolan'],
          ['rating', '5', '5'],
          ['imdb', 'tt1375666'],
          ['poster', 'https://example.com/inception.jpg']
        ]
      };

      render(<MovieComponent event={event} profileMap={profileMap} />);
      expect(screen.getByRole('heading', { level: 3 })).toBeDefined();
      expect(screen.getByText('(2010)')).toBeDefined();
      expect(screen.getByText('Christopher Nolan')).toBeDefined();
      expect(screen.getByText('Inception is phenomenal.')).toBeDefined();
      expect(screen.getByText('IMDb ↗')).toBeDefined();
    });

    it('renders movie list with multiple movie cards including a-tag references', () => {
      const event = {
        id: 'movie_list_1',
        kind: 30001,
        pubkey: mockPubkey,
        created_at: 1787317300,
        tags: [
          ['d', 'movies-rated'],
          ['title', 'Movies & TV: Rated Library'],
          ['a', '31985:pubkey:tt0133093', 'wss://relay.damus.io', 'The Matrix'],
          ['a', '31985:pubkey:tt0816692', 'wss://relay.damus.io', 'Interstellar']
        ]
      };

      render(<MovieComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Movies & TV: Rated Library')).toBeDefined();
      expect(screen.getByText('Movies in this list (2):')).toBeDefined();
      expect(screen.getByText('The Matrix')).toBeDefined();
      expect(screen.getByText('Interstellar')).toBeDefined();
      expect(screen.getAllByText('IMDb ↗').length).toBeGreaterThan(0);
    });

    it('renders single movie review (Kind 31985) with cover, rating, and director', () => {
      const event = {
        id: 'movie_review_31985',
        kind: 31985,
        pubkey: mockPubkey,
        content: 'Rated 4/5 stars for "Interstellar" (2014) by Christopher Nolan. Migrated from Letterboxd via x2nostr.',
        created_at: 1787317300,
        tags: [
          ['d', 'letterboxd:interstellar'],
          ['l', '0.8', 'rating'],
          ['imdb', 'tt0816692']
        ]
      };

      const { container } = render(<MovieComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('⭐ Movie Review & Rating')).toBeDefined();
      expect(container.querySelector('h3.movie-title').textContent).toContain('Interstellar');
      expect(screen.getByText('Christopher Nolan')).toBeDefined();
      expect(screen.getByText('IMDb ↗')).toBeDefined();
      expect(container.querySelector('img.movie-poster')).toBeDefined();
    });
  });

  describe('BookComponent', () => {
    it('renders book list with Bookstr and OpenLibrary links', () => {
      const event = {
        id: 'book_list_1',
        kind: 30001,
        pubkey: mockPubkey,
        created_at: 1787317300,
        tags: [
          ['d', 'books-reading'],
          ['title', 'Sci-Fi Reading List'],
          ['i', 'isbn:9780441172719', 'Dune'],
          ['i', 'isbn:9780553293357', 'Foundation']
        ]
      };

      render(<BookComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Sci-Fi Reading List')).toBeDefined();
      expect(screen.getByText('Dune')).toBeDefined();
      expect(screen.getByText('Foundation')).toBeDefined();
      expect(screen.getAllByText('Bookstr ↗').length).toBeGreaterThan(0);
      expect(screen.getAllByText('OpenLibrary ↗').length).toBeGreaterThan(0);
    });

    it('ignores placeholder "book" label and uses resolved title or ISBN fallback', () => {
      const event = {
        id: 'book_list_2',
        kind: 30001,
        pubkey: mockPubkey,
        created_at: 1787317300,
        tags: [
          ['d', 'books-to-read'],
          ['title', 'Books: Want to Read'],
          ['i', 'isbn:9789754704723', 'book'],
          ['i', 'isbn:9786055813284', 'book']
        ]
      };

      const { container } = render(<BookComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Books: Want to Read')).toBeDefined();
      expect(container.querySelector('.book-item-title').textContent).not.toBe('book');
    });

    it('renders single book review (Kind 31985) with cover, rating, and author', () => {
      const event = {
        id: 'review_31985',
        kind: 31985,
        pubkey: mockPubkey,
        content: 'Rated 5/5 stars for "Othello" by William Shakespeare. Migrated from Goodreads via x2nostr.',
        created_at: 1787317300,
        tags: [
          ['d', 'goodreads:12345'],
          ['isbn', '9789944884518']
        ]
      };

      const { container } = render(<BookComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('⭐ Book Review & Rating')).toBeDefined();
      expect(screen.getByText('Othello')).toBeDefined();
      expect(screen.getByText('William Shakespeare')).toBeDefined();
      expect(screen.getByText('View on Bookstr ↗')).toBeDefined();
      expect(screen.getByText('OpenLibrary ↗')).toBeDefined();
      expect(container.querySelector('img.book-cover')).toBeDefined();
    });
  });

  describe('ArticleComponent', () => {
    it('renders owner article card linking to blog.emre.xyz', () => {
      const event = {
        id: 'article_1',
        kind: 30023,
        pubkey: mockPubkey,
        created_at: 1787317300,
        tags: [
          ['d', 'nostr-architecture'],
          ['title', 'Nostr Client Architecture'],
          ['summary', 'Designing decentralized web applications.']
        ]
      };

      render(<ArticleComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('✍️ Long-form Article')).toBeDefined();
      expect(screen.getByText('Nostr Client Architecture')).toBeDefined();
      expect(screen.getByText('Designing decentralized web applications.')).toBeDefined();
      const link = screen.getByText('Read Full Article on blog.emre.xyz →');
      expect(link.getAttribute('href')).toBe('https://blog.emre.xyz/nostr-architecture');
    });

    it('renders liked / third-party article card with author and decentralized link', () => {
      const thirdPartyPubkey = '1111111111111111111111111111111111111111111111111111111111111111';
      const thirdPartyProfileMap = new Map([
        [thirdPartyPubkey, { name: 'posterchan', display_name: 'PosterChan Team' }]
      ]);

      const event = {
        id: 'article_2',
        kind: 30023,
        pubkey: thirdPartyPubkey,
        created_at: 1787317300,
        tags: [
          ['d', 'posterchan-os'],
          ['title', 'Introducing PosterChanOS'],
          ['summary', 'Nostr-powered Cloud Operating System']
        ]
      };

      const { container } = render(
        <ArticleComponent event={event} profileMap={thirdPartyProfileMap} />
      );

      expect(screen.getByText('❤️ Liked Article')).toBeDefined();
      expect(screen.getByText('PosterChan Team')).toBeDefined();
      expect(screen.getByText('Introducing PosterChanOS')).toBeDefined();
      expect(screen.getByText('Read Liked Article ↗')).toBeDefined();
      expect(container.innerHTML).not.toContain('blog.emre.xyz');
    });
  });

  describe('MediaComponent', () => {
    it('renders media photo card', () => {
      const event = {
        id: 'photo_1',
        kind: 20,
        pubkey: mockPubkey,
        content: 'Beautiful sunset https://example.com/sunset.jpg',
        created_at: 1787317300,
        tags: []
      };

      const { container } = render(<MediaComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('🖼️ Photo')).toBeDefined();
      expect(container.querySelector('img.post-image')).toBeDefined();
    });
  });

  describe('ListComponent', () => {
    it('renders people set list with members', () => {
      const friendPubkey = '1111111111111111111111111111111111111111111111111111111111111111';
      const friendProfileMap = new Map([
        [friendPubkey, { name: 'satoshi', display_name: 'Satoshi Nakamoto' }]
      ]);

      const event = {
        id: 'people_list_1',
        kind: 30000,
        pubkey: mockPubkey,
        created_at: 1787317300,
        tags: [
          ['d', 'core-devs'],
          ['title', 'Core Developers'],
          ['p', friendPubkey]
        ]
      };

      render(<ListComponent event={event} profileMap={friendProfileMap} />);
      expect(screen.getByText('Core Developers')).toBeDefined();
      expect(screen.getByText('@satoshi')).toBeDefined();
    });
  });

  describe('HighlightComponent', () => {
    it('renders quotation highlight card', () => {
      const event = {
        id: 'highlight_1',
        kind: 9802,
        pubkey: mockPubkey,
        content: 'Code is law, but community is sovereign.',
        created_at: 1787317300,
        tags: [
          ['r', 'https://example.com/article']
        ]
      };

      render(<HighlightComponent event={event} />);
      expect(screen.getByText('💡 Highlight')).toBeDefined();
      expect(screen.getByText('"Code is law, but community is sovereign."')).toBeDefined();
      expect(screen.getByText('Source ↗')).toBeDefined();
    });
  });

  describe('GenericComponent', () => {
    it('renders generic fallback for unknown kind', () => {
      const event = {
        id: 'other_1',
        kind: 9999,
        pubkey: mockPubkey,
        content: 'Custom experimental event',
        created_at: 1787317300,
        tags: []
      };

      render(<GenericComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Kind 9999')).toBeDefined();
      expect(screen.getByText('Custom experimental event')).toBeDefined();
    });

    it('renders friendly badge and tag items for Git repository (Kind 30617)', () => {
      const event = {
        id: 'repo_1',
        kind: 30617,
        pubkey: mockPubkey,
        content: '',
        created_at: 1787317300,
        tags: [
          ['d', 'nostr-ro-client'],
          ['name', 'Nostr Read-Only Client'],
          ['description', 'A decentralized client for Nostr'],
          ['clone', 'https://github.com/delirehberi/nostr-ro-client.git']
        ]
      };

      render(<GenericComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('💻 Git Repository (NIP-34)')).toBeDefined();
      expect(screen.getByText('Nostr Read-Only Client')).toBeDefined();
      expect(screen.getByText('A decentralized client for Nostr')).toBeDefined();
      expect(screen.getByText(/github\.com\/delirehberi/)).toBeDefined();
    });
  });

  describe('EventCard Dispatcher', () => {
    it('dispatches notes to SimpleTextPostComponent', () => {
      const event = {
        id: 'note_1',
        kind: 1,
        pubkey: mockPubkey,
        content: 'Dispatched Note',
        created_at: 1787317300,
        tags: []
      };

      const { container } = render(<EventCard event={event} profileMap={profileMap} />);
      expect(container.querySelector('.event-card[data-category="notes"]')).toBeDefined();
      expect(screen.getByText('Dispatched Note')).toBeDefined();
    });

    it('dispatches movies to MovieComponent', () => {
      const event = {
        id: 'movie_1',
        kind: 30001,
        pubkey: mockPubkey,
        created_at: 1787317300,
        tags: [
          ['d', 'movies-watched'],
          ['title', 'Watched Movies']
        ]
      };

      const { container } = render(<EventCard event={event} profileMap={profileMap} />);
      expect(container.querySelector('.event-card[data-category="movies"]')).toBeDefined();
      expect(screen.getByText('Watched Movies')).toBeDefined();
    });
  });

  describe('FilterBar', () => {
    it('renders tabs and subfilters, handling user clicks', () => {
      const handleSelect = vi.fn();
      const counts = { all: 10, notes: 4, movies: 3, books: 3 };

      render(
        <FilterBar
          categoryCounts={counts}
          activeCategory="movies"
          activeSub="watched"
          onSelectCategory={handleSelect}
        />
      );

      expect(screen.getByText('All')).toBeDefined();
      expect(screen.getByText('Movies')).toBeDefined();
      expect(screen.getByText('Watched')).toBeDefined();

      const notesTab = screen.getByText('Notes');
      fireEvent.click(notesTab);
      expect(handleSelect).toHaveBeenCalledWith('notes', 'all');

      const watchlistPill = screen.getByText('Watchlist');
      fireEvent.click(watchlistPill);
      expect(handleSelect).toHaveBeenCalledWith('movies', 'watchlist');
    });
  });
});
