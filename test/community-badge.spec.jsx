import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CommunityBadge, COMMUNITY_LANGUAGES } from '../src/components/CommunityBadge.jsx';

describe('CommunityBadge Component Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders default language EN text and language pills', () => {
    render(<CommunityBadge />);

    expect(screen.getByText('A nostr.org.tr community initiative')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Switch to English' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Switch to Türkçe' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Switch to Español' })).toBeDefined();

    const enPill = screen.getByRole('button', { name: 'Switch to English' });
    expect(enPill.classList.contains('active')).toBe(true);
    expect(enPill.getAttribute('aria-pressed')).toBe('true');
  });

  it('navigates to https://nostr.org.tr on badge link', () => {
    render(<CommunityBadge />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://nostr.org.tr');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('switches to TR and ES immediately upon clicking pills', () => {
    render(<CommunityBadge />);

    const trPill = screen.getByRole('button', { name: 'Switch to Türkçe' });
    fireEvent.click(trPill);

    expect(screen.getByText('Bir nostr.org.tr topluluk girişimidir')).toBeDefined();
    expect(trPill.classList.contains('active')).toBe(true);

    const esPill = screen.getByRole('button', { name: 'Switch to Español' });
    fireEvent.click(esPill);

    expect(screen.getByText('Una iniciativa comunitaria de nostr.org.tr')).toBeDefined();
    expect(esPill.classList.contains('active')).toBe(true);

    const enPill = screen.getByRole('button', { name: 'Switch to English' });
    fireEvent.click(enPill);

    expect(screen.getByText('A nostr.org.tr community initiative')).toBeDefined();
    expect(enPill.classList.contains('active')).toBe(true);
  });

  it('prevents event propagation when clicking language pills', () => {
    const onLinkClick = vi.fn();
    render(
      <div onClick={onLinkClick}>
        <CommunityBadge />
      </div>
    );

    const trPill = screen.getByRole('button', { name: 'Switch to Türkçe' });
    fireEvent.click(trPill);

    expect(onLinkClick).not.toHaveBeenCalled();
    expect(screen.getByText('Bir nostr.org.tr topluluk girişimidir')).toBeDefined();
  });

  it('supports keyboard navigation (Enter/Space) on pills', () => {
    render(<CommunityBadge />);

    const esPill = screen.getByRole('button', { name: 'Switch to Español' });
    fireEvent.keyDown(esPill, { key: 'Enter' });

    expect(screen.getByText('Una iniciativa comunitaria de nostr.org.tr')).toBeDefined();
    expect(esPill.classList.contains('active')).toBe(true);

    const trPill = screen.getByRole('button', { name: 'Switch to Türkçe' });
    fireEvent.keyDown(trPill, { key: ' ' });

    expect(screen.getByText('Bir nostr.org.tr topluluk girişimidir')).toBeDefined();
    expect(trPill.classList.contains('active')).toBe(true);
  });

  it('auto-cycles through languages at configured interval', () => {
    render(<CommunityBadge intervalMs={4000} />);

    expect(screen.getByText('A nostr.org.tr community initiative')).toBeDefined();

    // Advance 4s -> TR
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Bir nostr.org.tr topluluk girişimidir')).toBeDefined();

    // Advance 4s -> ES
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Una iniciativa comunitaria de nostr.org.tr')).toBeDefined();

    // Advance 4s -> EN (cycles back)
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('A nostr.org.tr community initiative')).toBeDefined();
  });

  it('pauses auto-cycling when hovering or focusing the badge', () => {
    const { container } = render(<CommunityBadge intervalMs={4000} />);
    const wrapper = container.querySelector('.community-badge-wrapper');

    // Hover to pause
    fireEvent.mouseEnter(wrapper);

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    // Should still be on EN
    expect(screen.getByText('A nostr.org.tr community initiative')).toBeDefined();

    // Leave hover
    fireEvent.mouseLeave(wrapper);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // Resumed: now TR
    expect(screen.getByText('Bir nostr.org.tr topluluk girişimidir')).toBeDefined();
  });
});
