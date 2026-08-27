import React from 'react';
import { extractEventMetadata } from '../kinds.js';
import { RatingStars } from './RatingStars.jsx';
import { FormattedContent } from './FormattedContent.jsx';
import { useBookMetadata } from '../hooks/useBookMetadata.js';

export function BookItemCard({ item }) {
  const metadata = useBookMetadata(item.isbn || item.value, item.title);
  const displayTitle = metadata.title || item.title || (item.isbn ? `ISBN: ${item.isbn}` : 'Book');
  const coverImg = metadata.cover || item.coverUrl;

  return (
    <div className="book-item-card">
      {coverImg && (
        <img
          src={coverImg}
          alt={displayTitle}
          className="book-mini-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div className="book-item-info">
        <div className="book-item-title">{displayTitle}</div>
        {metadata.author && (
          <div className="book-author" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
            by {metadata.author}
          </div>
        )}
        <div className="book-item-actions">
          {item.bookstrUrl && (
            <a
              href={item.bookstrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-mini-action"
            >
              Bookstr ↗
            </a>
          )}
          {item.openLibraryUrl && (
            <a
              href={item.openLibraryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-mini-action"
            >
              OpenLibrary ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function BookComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);

  const statusLabels = {
    reading: '📖 Currently Reading',
    read: '✅ Read',
    'to-read': '🔖 To Read',
    rated: '⭐ Book Review & Rating',
  };
  const statusBadge = statusLabels[meta.subCategory] || '📚 Book';

  // Deduplicate items by ISBN value
  const seenIsbns = new Set();
  const isbnItems = meta.items
    .filter((i) => i.type === 'isbn')
    .filter((i) => {
      if (!i.value || seenIsbns.has(i.value)) return false;
      seenIsbns.add(i.value);
      return true;
    });

  const isMultiBookList = isbnItems.length > 1;
  const coverImage = meta.image || (meta.isbn ? `https://covers.openlibrary.org/b/isbn/${meta.isbn}-M.jpg` : null);

  return (
    <>
      <div className="card-badge book-badge">{statusBadge}</div>
      <div className="book-card-body">
        {coverImage && !isMultiBookList && (
          <div className="book-cover-wrap">
            <img
              src={coverImage}
              alt={meta.title || 'Book Cover'}
              className="book-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="book-details">
          <h3 className="book-title">{meta.title || (meta.isbn ? `Book: ${meta.isbn}` : 'Untitled Book')}</h3>
          {meta.author && (
            <div className="book-author">
              by <strong>{meta.author}</strong>
            </div>
          )}
          {meta.isbn && !isMultiBookList && (
            <div className="book-meta-item">
              ISBN: <code>{meta.isbn}</code>
            </div>
          )}
          <RatingStars rating={meta.rating} />
          {meta.summary && <div className="book-summary">{meta.summary}</div>}

          {isMultiBookList && (
            <>
              <div className="list-section-title">
                Books in this list ({isbnItems.length}):
              </div>
              <div className="book-items-grid">
                {isbnItems.map((item, idx) => (
                  <BookItemCard key={idx} item={item} />
                ))}
              </div>
            </>
          )}

          {event.content && event.content !== meta.summary && (
            <div className="post-content book-content">
              <FormattedContent content={event.content} profileMap={profileMap} />
            </div>
          )}
        </div>
      </div>

      <div className="post-meta card-actions">
        <span>{new Date(event.created_at * 1000).toLocaleDateString()}</span>
        {meta.isbn && (
          <a
            href={`https://openlibrary.org/isbn/${meta.isbn}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-mini-action"
          >
            OpenLibrary ↗
          </a>
        )}
        {meta.externalUrl && (
          <a
            href={meta.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-action"
          >
            View on Bookstr ↗
          </a>
        )}
        <a
          href={`https://njump.me/${event.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit' }}
        >
          relay link
        </a>
      </div>
    </>
  );
}

export default BookComponent;
