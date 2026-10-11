// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('index.html third-party assets', () => {
  it('pins every emre.xyz script and stylesheet with Subresource Integrity', () => {
    const tags = html.match(/<(?:script|link)\b[^>]*https:\/\/emre\.xyz\/[^>]*>/g) || [];
    expect(tags.length).toBeGreaterThanOrEqual(2);
    for (const tag of tags) {
      expect(tag).toMatch(/integrity="sha384-[A-Za-z0-9+/]{64}"/);
      expect(tag).toMatch(/crossorigin="anonymous"/);
    }
  });
});
