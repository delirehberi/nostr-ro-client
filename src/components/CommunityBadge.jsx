import React, { useState, useEffect, useRef, useCallback } from 'react';

export const COMMUNITY_LANGUAGES = [
  {
    code: 'EN',
    label: 'English',
    text: 'A nostr.org.tr community initiative',
  },
  {
    code: 'TR',
    label: 'Türkçe',
    text: 'Bir nostr.org.tr topluluk girişimidir',
  },
  {
    code: 'ES',
    label: 'Español',
    text: 'Una iniciativa comunitaria de nostr.org.tr',
  },
];

const TARGET_URL = 'https://nostr.org.tr';
const AUTO_CYCLE_INTERVAL_MS = 4000;

export function CommunityBadge({
  languages = COMMUNITY_LANGUAGES,
  intervalMs = AUTO_CYCLE_INTERVAL_MS,
  targetUrl = TARGET_URL,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimeoutRef = useRef(null);

  const totalLanguages = languages.length;

  const changeLanguage = useCallback((newIndex) => {
    setIsAnimating(true);
    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current);
    }
    setCurrentIndex(newIndex);
    animTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  }, []);

  // Auto-cycling timer
  useEffect(() => {
    if (isPaused || totalLanguages <= 1) return;

    const timer = setInterval(() => {
      changeLanguage((prev) => (prev + 1) % totalLanguages);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPaused, totalLanguages, intervalMs, changeLanguage]);

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }
    };
  }, []);

  const handlePillClick = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    changeLanguage(index);
  };

  const handlePillKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      changeLanguage(index);
    }
  };

  const currentLang = languages[currentIndex] || languages[0];

  return (
    <div
      className="community-badge-wrapper"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="community-badge"
        aria-label={`${currentLang.text} - Open ${targetUrl}`}
      >
        <span className="community-badge-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </span>

        <span
          className={`community-badge-text ${isAnimating ? 'fade-transition' : ''}`}
        >
          {currentLang.text}
        </span>

        <span className="community-badge-arrow" aria-hidden="true">
          ↗
        </span>

        <div
          className="community-lang-pills"
          role="group"
          aria-label="Language selector"
          onClick={(e) => e.stopPropagation()}
        >
          {languages.map((lang, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                type="button"
                key={lang.code}
                className={`community-lang-pill ${isActive ? 'active' : ''}`}
                onClick={(e) => handlePillClick(e, idx)}
                onKeyDown={(e) => handlePillKeyDown(e, idx)}
                aria-pressed={isActive}
                aria-label={`Switch to ${lang.label}`}
                title={`Switch to ${lang.label}`}
              >
                {lang.code}
              </button>
            );
          })}
        </div>
      </a>
    </div>
  );
}

export default CommunityBadge;
