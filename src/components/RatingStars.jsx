import React from 'react';

export function RatingStars({ rating }) {
  if (rating === null || rating === undefined) return null;
  const normalized = Math.max(0, Math.min(5, rating));
  const fullStars = Math.floor(normalized);
  const hasHalf = normalized - fullStars >= 0.4;
  const stars = [];

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <span key={i} className="star filled">
          ★
        </span>
      );
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <span key={i} className="star half">
          ★
        </span>
      );
    } else {
      stars.push(
        <span key={i} className="star empty">
          ☆
        </span>
      );
    }
  }

  return (
    <div className="rating-badge" title={`Rating: ${normalized.toFixed(1)}/5`}>
      {stars} <span className="rating-number">{normalized.toFixed(1)}</span>
    </div>
  );
}

export default RatingStars;
