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
import { GitEventComponent } from '../src/components/GitEventComponent.jsx';
import { AppHandlerComponent } from '../src/components/AppHandlerComponent.jsx';
import { SnippetComponent } from '../src/components/SnippetComponent.jsx';
import { ReactionComponent } from '../src/components/ReactionComponent.jsx';
import { QuotedEventCard } from '../src/components/QuotedEventCard.jsx';
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

    it('renders repository context banner when note comments on a repository', () => {
      const event = {
        id: 'note_repo_comment',
        kind: 1,
        pubkey: mockPubkey,
        content: 'I was planning to start this type of project.',
        created_at: 1787317300,
        tags: [
          ['r', 'https://github.com/nostr-protocol/nips/blob/master/C0.md']
        ]
      };

      const { container } = render(<SimpleTextPostComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Commented on repository:')).toBeDefined();
      expect(screen.getByText('nostr-protocol/nips: C0.md')).toBeDefined();
      expect(container.querySelector('.repo-context-banner')).toBeDefined();
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
    it('renders people set list with avatar stack and ellipsis for extra members', () => {
      const friendPubkey1 = '1111111111111111111111111111111111111111111111111111111111111111';
      const friendPubkey2 = '2222222222222222222222222222222222222222222222222222222222222222';
      const friendPubkey3 = '3333333333333333333333333333333333333333333333333333333333333333';
      const friendPubkey4 = '4444444444444444444444444444444444444444444444444444444444444444';
      const friendProfileMap = new Map([
        [friendPubkey1, { name: 'satoshi', display_name: 'Satoshi Nakamoto' }],
        [friendPubkey2, { name: 'hal', display_name: 'Hal Finney' }],
        [friendPubkey3, { name: 'nick', display_name: 'Nick Szabo' }],
        [friendPubkey4, { name: 'adam', display_name: 'Adam Back' }]
      ]);

      const event = {
        id: 'people_list_1',
        kind: 30000,
        pubkey: mockPubkey,
        created_at: 1787317300,
        tags: [
          ['d', 'core-devs'],
          ['title', 'Core Developers'],
          ['p', friendPubkey1],
          ['p', friendPubkey2],
          ['p', friendPubkey3],
          ['p', friendPubkey4]
        ]
      };

      const { container } = render(<ListComponent event={event} profileMap={friendProfileMap} />);
      expect(screen.getByText('Core Developers')).toBeDefined();
      expect(container.querySelector('.follow-count-label').textContent).toContain('4 accounts followed');
      expect(container.querySelectorAll('.avatar-stack-img').length).toBe(3);
      expect(screen.getByText('+1')).toBeDefined();
    });

    it('renders Kind 3 follow list with first 3 avatars and ellipsis', () => {
      const p1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const p2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const p3 = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
      const p4 = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
      const p5 = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      const event = {
        id: 'follow_list_1',
        kind: 3,
        pubkey: mockPubkey,
        created_at: 1787317300,
        tags: [
          ['p', p1],
          ['p', p2],
          ['p', p3],
          ['p', p4],
          ['p', p5]
        ]
      };

      const { container } = render(<ListComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Follow List')).toBeDefined();
      expect(container.querySelector('.follow-count-label').textContent).toContain('5 accounts followed');
      expect(container.querySelectorAll('.avatar-stack-img').length).toBe(3);
      expect(screen.getByText('+2')).toBeDefined();
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
    it('renders clean App Data card for Kind 30078 instead of raw base64 data dump', () => {
      const event = {
        id: 'app_data_1',
        kind: 30078,
        pubkey: mockPubkey,
        content: 'AvBNOIR0iO2y6/H81YQW6dwuOIuq+rnWN+Ljn9bx5EL1IUEezmgr9Ubn7sEt1QIgXIOPzX1X+eqmJrLPO0YUna',
        created_at: 1787317300,
        tags: [
          ['d', 'ditto:metadata'],
          ['title', 'Ditto Metadata']
        ]
      };

      const { container } = render(<GenericComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Ditto Metadata')).toBeDefined();
      expect(screen.getByText(/Application configuration & state update for/)).toBeDefined();
      expect(screen.getByText('Ditto')).toBeDefined();
      expect(container.querySelector('.app-data-details')).toBeDefined();
      expect(screen.getByText(/Encrypted \/ Serialized Payload/)).toBeDefined();
    });

    it('renders clean Label & Review card for Kind 1985 with target and labels', () => {
      const event = {
        id: 'review_nip_1',
        kind: 1985,
        pubkey: mockPubkey,
        content: 'Looks solid and ready for merge.',
        created_at: 1787317300,
        tags: [
          ['L', 'nip'],
          ['l', 'approved', 'nip'],
          ['i', 'https://github.com/nostr-protocol/nips/blob/master/C0.md']
        ]
      };

      const { container } = render(<GenericComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('⭐ Label / Review')).toBeDefined();
      expect(screen.getByText('Reviewing / Labeled:')).toBeDefined();
      expect(container.querySelector('.review-target-link').textContent).toContain('nostr-protocol/nips: C0.md');
      expect(screen.getByText('🏷️ approved')).toBeDefined();
      expect(screen.getByText('Looks solid and ready for merge.')).toBeDefined();
    });

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
    it('defaults activeCategory to notes and activates notes subfilters', () => {
      const handleSelect = vi.fn();
      const counts = { all: 10, notes: 4, movies: 3, books: 3 };

      const { container } = render(
        <FilterBar
          categoryCounts={counts}
          onSelectCategory={handleSelect}
        />
      );

      const notesTab = container.querySelector('.filter-tab.active[data-category="notes"]');
      expect(notesTab).toBeDefined();
      expect(notesTab.textContent).toContain('Notes');
      expect(notesTab.textContent).toContain('4');

      const notesSubRow = container.querySelector('#sub-row-notes.sub-filter-row.visible');
      expect(notesSubRow).toBeDefined();
      expect(screen.getByText('All Notes')).toBeDefined();
      expect(screen.getByText('Posts')).toBeDefined();
      expect(screen.getByText('Replies')).toBeDefined();
      expect(screen.getByText('Reposts')).toBeDefined();
    });

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

  describe('GitEventComponent', () => {
    it('renders NIP-34 pull request with repository banner and gitworkshop link', () => {
      const event = {
        id: '98ff1e09e02bc7420e39d714290898c92c6ebe6b',
        pubkey: mockPubkey,
        kind: 1618,
        content: 'as nostr.org.tr developer, i am giving turkish translation support...',
        created_at: 1787317300,
        tags: [
          ['a', `30617:${mockPubkey}:ditto`],
          ['commit', '98ff1e09e02bc7420e39d714290898c92c6ebe6b'],
          ['subject', 'Turkish translations added for UI']
        ]
      };

      const { container } = render(<GitEventComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Turkish translations added for UI')).toBeDefined();
      expect(screen.getByText('ditto')).toBeDefined();
      expect(screen.getByText('98ff1e0')).toBeDefined();
      expect(container.querySelector('.btn-gitworkshop')).toBeDefined();
    });

    it('renders NIP-34 repository announcement with clone button', () => {
      const event = {
        id: 'repo_ann_1',
        pubkey: mockPubkey,
        kind: 30617,
        content: 'A decentralized client repository',
        created_at: 1787317300,
        tags: [
          ['d', 'Snippets'],
          ['clone', 'https://relay.ngit.dev/Snippets.git']
        ]
      };

      const { container } = render(<GitEventComponent event={event} profileMap={profileMap} />);
      expect(screen.getAllByText('Snippets').length).toBeGreaterThan(0);
      expect(container.querySelector('.git-clone-code').textContent).toContain('git clone https://relay.ngit.dev/Snippets.git');
      expect(container.querySelector('.btn-git-copy')).toBeDefined();
    });
  });

  describe('AppHandlerComponent', () => {
    it('renders NIP-89 app announcement with website and NostrHub links', () => {
      const event = {
        id: 'app_1',
        pubkey: mockPubkey,
        kind: 31990,
        content: JSON.stringify({
          name: 'Snippets',
          about: 'Decentralized code snippet sharing',
          website: 'https://snips.emre.xyz',
          nip05: 'delirehberi@emre.xyz'
        }),
        created_at: 1787317300,
        tags: [
          ['d', '5wo5lk0l'],
          ['k', '1337']
        ]
      };

      const { container } = render(<AppHandlerComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('Snippets')).toBeDefined();
      expect(screen.getByText('Decentralized code snippet sharing')).toBeDefined();
      expect(screen.getByText(/Open Website/)).toBeDefined();
      expect(screen.getByText(/View on NostrHub/)).toBeDefined();
      expect(container.querySelector('.btn-nostrhub')).toBeDefined();
    });
  });

  describe('SnippetComponent', () => {
    it('renders code snippet with language tag and snips.emre.xyz link', () => {
      const event = {
        id: '3092759dac162b55606ba8339ce1400cf62a0fc1e45d6e3d1d2e0a831d0e59cd',
        pubkey: mockPubkey,
        kind: 1337,
        content: 'def rotate_video():\n    pass',
        created_at: 1787317300,
        tags: [
          ['title', 'rotatevideo.ipynb'],
          ['l', 'python']
        ]
      };

      const { container } = render(<SnippetComponent event={event} profileMap={profileMap} />);
      expect(screen.getByText('💻 rotatevideo.ipynb')).toBeDefined();
      expect(screen.getByText('python')).toBeDefined();
      expect(container.querySelector('.snippet-code-pre code').textContent).toContain('def rotate_video()');
      const snipsBtn = container.querySelector('.btn-snips');
      expect(snipsBtn).toBeDefined();
      expect(snipsBtn.getAttribute('href')).toBe('https://snips.emre.xyz/#/s/3092759dac162b55606ba8339ce1400cf62a0fc1e45d6e3d1d2e0a831d0e59cd');
    });
  });

  describe('ReactionComponent', () => {
    it('renders reaction with embedded target preview', () => {
      const targetEvent = {
        id: 'target_post_1',
        pubkey: mockPubkey,
        kind: 1,
        content: 'Original post content that was liked',
        created_at: 1787317000,
        tags: []
      };

      const eventMap = new Map([
        [targetEvent.id, targetEvent]
      ]);

      const event = {
        id: 'reaction_evt_1',
        pubkey: mockPubkey,
        kind: 7,
        content: '+',
        created_at: 1787317300,
        tags: [
          ['e', targetEvent.id],
          ['p', mockPubkey]
        ]
      };

      const { container } = render(
        <ReactionComponent event={event} profileMap={profileMap} eventMap={eventMap} />
      );
      expect(screen.getByText('Liked post')).toBeDefined();
      expect(screen.getByText('Original post content that was liked')).toBeDefined();
      expect(container.querySelector('.reaction-badge')).toBeDefined();
    });
  });

  describe('QuotedEventCard and SimpleTextPostComponent quotes', () => {
    it('renders QuotedEventCard under note when quoting another event', () => {
      const quotedEvent = {
        id: 'quoted_note_1',
        pubkey: mockPubkey,
        kind: 1,
        content: 'Turkish Nostr community is growing!',
        created_at: 1787316000,
        tags: []
      };

      const eventMap = new Map([
        [quotedEvent.id, quotedEvent]
      ]);

      const noteEvent = {
        id: 'root_note_1',
        pubkey: mockPubkey,
        kind: 1,
        content: 'Nostr Turkish Community have nostr account now!\n\n[event:nevent1qqsp3290x]',
        created_at: 1787317300,
        tags: [
          ['q', quotedEvent.id]
        ]
      };

      render(
        <SimpleTextPostComponent event={noteEvent} profileMap={profileMap} eventMap={eventMap} />
      );
      expect(screen.getByText('Nostr Turkish Community have nostr account now!')).toBeDefined();
      expect(screen.getByText('Turkish Nostr community is growing!')).toBeDefined();
    });
  });

  describe('ListComponent with Kind 10017', () => {
    it('renders Git Follow List with GitWorkshop profile links', () => {
      const event = {
        id: 'git_follow_1',
        pubkey: mockPubkey,
        kind: 10017,
        content: '',
        created_at: 1787317300,
        tags: [
          ['p', mockPubkey]
        ]
      };

      const { container } = render(
        <ListComponent event={event} profileMap={profileMap} />
      );
      expect(screen.getByText('Git Follow List')).toBeDefined();
      expect(screen.getByText(/developers \/ contributors/)).toBeDefined();
      expect(container.querySelector('.git-badge')).toBeDefined();
    });
  });
});

