export const CATEGORIES_CONFIG = [
  {
    id: 'all',
    label: 'All',
    icon: 'sparkles',
    subFilters: []
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: 'message-square',
    subFilters: [
      { id: 'all', label: 'All Notes' },
      { id: 'posts', label: 'Posts' },
      { id: 'replies', label: 'Replies' },
      { id: 'reposts', label: 'Reposts' }
    ]
  },
  {
    id: 'books',
    label: 'Books',
    icon: 'book-open',
    subFilters: [
      { id: 'all', label: 'All Books' },
      { id: 'reading', label: 'Reading' },
      { id: 'read', label: 'Read' },
      { id: 'to-read', label: 'To Read' },
      { id: 'rated', label: 'Reviews & Ratings' }
    ]
  },
  {
    id: 'movies',
    label: 'Movies',
    icon: 'film',
    subFilters: [
      { id: 'all', label: 'All Movies' },
      { id: 'watched', label: 'Watched' },
      { id: 'rated', label: 'Reviews & Ratings' },
      { id: 'watchlist', label: 'Watchlist' }
    ]
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'image',
    subFilters: [
      { id: 'all', label: 'All Media' },
      { id: 'photos', label: 'Photos' },
      { id: 'videos', label: 'Videos' }
    ]
  },
  {
    id: 'lists',
    label: 'Lists',
    icon: 'list',
    subFilters: [
      { id: 'all', label: 'All Lists' },
      { id: 'people', label: 'People' },
      { id: 'bookmarks', label: 'Bookmarks' },
      { id: 'curations', label: 'Curations' }
    ]
  },
  {
    id: 'articles',
    label: 'Articles',
    icon: 'file-text',
    subFilters: [
      { id: 'all', label: 'All Articles' },
      { id: 'my', label: 'My Articles' },
      { id: 'liked', label: 'Liked & Curated' }
    ]
  },
  {
    id: 'highlights',
    label: 'Highlights',
    icon: 'bookmark',
    subFilters: []
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'more-horizontal',
    subFilters: []
  }
];

/** Relay `kinds` filter used to fetch each category. */
export const CATEGORY_KINDS_MAP = {
  books: [30040, 30041, 30001, 30003, 1985],
  movies: [30001, 30003, 1985, 31922, 31923, 31989],
  media: [20, 21, 22, 1063, 1],
  lists: [30000, 30001, 30002, 30003, 30004, 30005, 10000, 10001, 10002, 10003],
  notes: [1, 6, 16, 1111],
  articles: [30023, 30024],
  highlights: [9802],
};
