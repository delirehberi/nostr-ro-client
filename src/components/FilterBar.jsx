import React from 'react';
import { CATEGORIES_CONFIG } from '../kinds.js';

export function FilterBar({
  categoryCounts = {},
  activeCategory = 'notes',
  activeSub = 'all',
  onSelectCategory,
}) {
  const activeCategoryConfig = CATEGORIES_CONFIG.find((c) => c.id === activeCategory);

  return (
    <nav className="filter-container" aria-label="Nostr categories">
      <div className="filter-tabs-scroll">
        {CATEGORIES_CONFIG.map((cat) => {
          const count = categoryCounts[cat.id] || 0;
          const isActive = cat.id === activeCategory;
          return (
            <button
              type="button"
              key={cat.id}
              className={`filter-tab ${isActive ? 'active' : ''}`}
              data-category={cat.id}
              onClick={() => onSelectCategory(cat.id, 'all')}
            >
              <span className="tab-label">{cat.label}</span>
              <span className="tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="sub-filters-container">
        {CATEGORIES_CONFIG.map((cat) => {
          if (!cat.subFilters || cat.subFilters.length === 0) return null;
          const isParentActive = cat.id === activeCategory;

          return (
            <div
              key={cat.id}
              className={`sub-filter-row ${isParentActive ? 'visible' : ''}`}
              id={`sub-row-${cat.id}`}
            >
              {cat.subFilters.map((sub) => {
                const isSubActive = isParentActive && sub.id === activeSub;
                return (
                  <button
                    type="button"
                    key={sub.id}
                    className={`sub-pill ${isSubActive ? 'active' : ''}`}
                    data-parent={cat.id}
                    data-sub={sub.id}
                    onClick={() => onSelectCategory(cat.id, sub.id)}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default FilterBar;
