import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { safeHttpUrl } from '../src/safeUrl.js';
import { ListComponent } from '../src/components/ListComponent.jsx';
import { AppHandlerComponent } from '../src/components/AppHandlerComponent.jsx';
import { ProfileAvatar } from '../src/components/ProfileAvatar.jsx';

const pubkey = '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a';

describe('safeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(safeHttpUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHttpUrl('  http://example.com ')).toBe('http://example.com');
  });

  it('rejects other schemes, relative paths and non-strings', () => {
    ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'ftp://x.com', '//evil.com', '/relative', 'wss://relay', '', null, undefined, 42].forEach(
      (v) => expect(safeHttpUrl(v)).toBeNull()
    );
  });
});

describe('components never render unsafe URLs from event data', () => {
  it('ListComponent drops javascript: links', () => {
    const event = {
      id: 'l1',
      pubkey,
      kind: 30001,
      created_at: 1,
      content: '',
      tags: [['d', 'links'], ['title', 'Links'], ['r', 'javascript:alert(1)'], ['web', 'javascript:alert(2)'], ['server', 'data:text/html,x']],
    };
    const { container } = render(<ListComponent event={event} profileMap={new Map()} />);
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') || '');
    expect(hrefs.some((h) => h.toLowerCase().startsWith('javascript:') || h.startsWith('data:'))).toBe(false);
  });

  it('AppHandlerComponent drops unsafe website and picture', () => {
    const event = {
      id: 'a1',
      pubkey,
      kind: 31990,
      created_at: 1,
      content: JSON.stringify({ name: 'Evil', website: 'javascript:alert(1)', picture: 'javascript:alert(1)' }),
      tags: [['d', 'evil'], ['k', '1']],
    };
    const { container } = render(<AppHandlerComponent event={event} profileMap={new Map()} />);
    expect(container.innerHTML.toLowerCase()).not.toContain('javascript:');
  });

  it('ProfileAvatar falls back to the default avatar for unsafe pictures', () => {
    const profileMap = new Map([[pubkey, { name: 'x', picture: 'javascript:alert(1)' }]]);
    const { container } = render(<ProfileAvatar pubkey={pubkey} profileMap={profileMap} />);
    expect(container.querySelector('img').getAttribute('src')).toContain('robohash.org');
  });
});
