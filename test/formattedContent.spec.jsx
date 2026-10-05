import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormattedContent } from '../src/components/FormattedContent.jsx';

describe('FormattedContent embeds', () => {
  it('renders the video placeholder as a labelled button that starts playback', () => {
    const { container } = render(<FormattedContent content="https://cdn.example.com/my-trip_2024.mp4" />);
    const button = screen.getByRole('button', { name: 'Play video my trip 2024' });
    expect(button.tagName).toBe('BUTTON');
    fireEvent.click(button);
    expect(container.querySelector('video').getAttribute('src')).toBe('https://cdn.example.com/my-trip_2024.mp4');
  });

  it('uses the file name as image alt text and a generic one when there is none', () => {
    render(<FormattedContent content={'https://x.com/photos/sunset-beach.jpg\nhttps://x.com/a/.png'} />);
    expect(screen.getByAltText('sunset beach')).toBeTruthy();
    expect(screen.getByAltText('Embedded image')).toBeTruthy();
  });

  it('embeds YouTube privately and sandboxed', () => {
    const { container } = render(<FormattedContent content="https://youtu.be/dQw4w9WgXcQ" />);
    const frame = container.querySelector('iframe');
    expect(frame.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts');
    expect(frame.hasAttribute('frameborder')).toBe(false);
  });
});
