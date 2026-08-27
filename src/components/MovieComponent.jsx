import React from 'react';
import { extractEventMetadata } from '../kinds.js';
import { RatingStars } from './RatingStars.jsx';
import { FormattedContent } from './FormattedContent.jsx';
import { useMovieMetadata } from '../hooks/useMovieMetadata.js';

export function MovieItemCard({ item }) {
  const metadata = useMovieMetadata(item.value || item.imdbId, item.title, item.posterUrl);
  const displayTitle = metadata.title || item.title || (item.value ? `Movie: ${item.value}` : 'Movie');
  const posterImg = metadata.poster || item.posterUrl;

  return (
    <div className="movie-item-card">
      {posterImg ? (
        <img
          src={posterImg}
          alt={displayTitle}
          className="movie-mini-poster"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="movie-mini-poster movie-poster-placeholder">
          🎬
        </div>
      )}
      <div className="movie-item-info">
        <div className="movie-item-title">{displayTitle}</div>
        {metadata.year && (
          <div className="movie-year" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
            ({metadata.year})
          </div>
        )}
        {metadata.director && (
          <div className="movie-director" style={{ fontSize: '0.78rem' }}>
            by {metadata.director}
          </div>
        )}
        <div className="movie-item-actions">
          {item.imdbUrl && (
            <a
              href={item.imdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-mini-action"
            >
              IMDb ↗
            </a>
          )}
          {item.tmdbUrl && (
            <a
              href={item.tmdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-mini-action"
            >
              TMDb ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function MovieComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);

  const statusLabels = {
    watched: '🎬 Watched',
    watchlist: '🍿 Watchlist',
    rated: '⭐ Movie Review & Rating',
  };
  const statusBadge = statusLabels[meta.subCategory] || '🎥 Movie';

  // Deduplicate movie items by ID/value
  const seenIds = new Set();
  const movieItems = meta.items
    .filter((i) => i.type === 'imdb' || i.type === 'tmdb' || i.type === 'movie' || i.type === 'a' || i.type === 'e')
    .filter((i) => {
      if (!i.value || seenIds.has(i.value)) return false;
      seenIds.add(i.value);
      return true;
    });

  const isMultiMovieList = movieItems.length > 1;
  const posterImage = meta.image || (meta.imdb ? `https://images.metahub.space/poster/medium/${meta.imdb}/img.jpg` : null);

  return (
    <>
      <div className="card-badge movie-badge">{statusBadge}</div>
      <div className="movie-card-body">
        {posterImage && !isMultiMovieList && (
          <div className="movie-poster-wrap">
            <img
              src={posterImage}
              alt={meta.title || 'Movie Poster'}
              className="movie-poster"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="movie-details">
          <h3 className="movie-title">
            {meta.title || 'Untitled Film'}{' '}
            {meta.year && <span className="movie-year">({meta.year})</span>}
          </h3>
          {meta.author && (
            <div className="movie-director">
              Directed by <strong>{meta.author}</strong>
            </div>
          )}
          <RatingStars rating={meta.rating} />
          {meta.summary && <div className="movie-summary">{meta.summary}</div>}

          {isMultiMovieList && (
            <>
              <div className="list-section-title">
                Movies in this list ({movieItems.length}):
              </div>
              <div className="movie-items-grid">
                {movieItems.map((item, idx) => (
                  <MovieItemCard key={idx} item={item} />
                ))}
              </div>
            </>
          )}

          {event.content && event.content !== meta.summary && (
            <div className="post-content movie-content">
              <FormattedContent content={event.content} profileMap={profileMap} />
            </div>
          )}
        </div>
      </div>

      <div className="post-meta card-actions">
        <span>{new Date(event.created_at * 1000).toLocaleDateString()}</span>
        {meta.imdb && (
          <a
            href={`https://www.imdb.com/title/${meta.imdb}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-mini-action"
          >
            IMDb ↗
          </a>
        )}
        {meta.tmdb && (
          <a
            href={`https://www.themoviedb.org/movie/${meta.tmdb}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-mini-action"
          >
            TMDb ↗
          </a>
        )}
        {meta.externalUrl && !meta.imdb && !meta.tmdb && (
          <a
            href={meta.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-action"
          >
            View Review ↗
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

export default MovieComponent;
