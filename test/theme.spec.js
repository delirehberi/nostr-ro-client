import { describe, it, expect } from 'vitest';
import {
  sanitizeHexColor,
  sanitizeFontFamily,
  sanitizeUrl,
  getRelativeLuminance,
  parseThemeEvent,
  generateThemeCss
} from '../src/theme.js';

describe('theme utilities', () => {
  describe('sanitizeHexColor', () => {
    it('normalizes 6-digit hex colors', () => {
      expect(sanitizeHexColor('#1C1515')).toBe('#1c1515');
      expect(sanitizeHexColor('#ffffff')).toBe('#ffffff');
    });

    it('expands 3-digit hex colors', () => {
      expect(sanitizeHexColor('#fff')).toBe('#ffffff');
      expect(sanitizeHexColor('#123')).toBe('#112233');
    });

    it('rejects invalid hex formats', () => {
      expect(sanitizeHexColor('red')).toBeNull();
      expect(sanitizeHexColor('#xyz123')).toBeNull();
      expect(sanitizeHexColor('#1234567')).toBeNull();
      expect(sanitizeHexColor('')).toBeNull();
      expect(sanitizeHexColor(null)).toBeNull();
    });
  });

  describe('sanitizeFontFamily', () => {
    it('accepts valid font names', () => {
      expect(sanitizeFontFamily('Lora')).toBe('Lora');
      expect(sanitizeFontFamily('Playfair Display')).toBe('Playfair Display');
      expect(sanitizeFontFamily('Fira-Code')).toBe('Fira-Code');
    });

    it('rejects invalid or injection characters', () => {
      expect(sanitizeFontFamily('Lora"; alert(1); "')).toBeNull();
      expect(sanitizeFontFamily('sans-serif</style>')).toBeNull();
    });
  });

  describe('sanitizeUrl', () => {
    it('accepts valid http and https urls', () => {
      expect(sanitizeUrl('https://cdn.jsdelivr.net/fontsource/fonts/lora.woff2')).toBe(
        'https://cdn.jsdelivr.net/fontsource/fonts/lora.woff2'
      );
      expect(sanitizeUrl('http://example.com/bg.jpg')).toBe('http://example.com/bg.jpg');
    });

    it('rejects malicious or invalid URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeUrl('https://example.com/bg.jpg" onclick="alert(1)')).toBeNull();
    });
  });

  describe('getRelativeLuminance', () => {
    it('calculates accurate luminance', () => {
      expect(getRelativeLuminance('#000000')).toBeCloseTo(0, 2);
      expect(getRelativeLuminance('#ffffff')).toBeCloseTo(1, 2);
      expect(getRelativeLuminance('#1c1515')).toBeLessThan(0.2); // dark background
    });
  });

  describe('parseThemeEvent', () => {
    it('parses a complete Kind 16767 active profile theme event', () => {
      const event = {
        kind: 16767,
        tags: [
          ['c', '#1c1515', 'background'],
          ['c', '#ffffff', 'text'],
          ['c', '#ee5b2b', 'primary'],
          ['f', 'Lora', 'https://cdn.jsdelivr.net/fontsource/fonts/lora:vf@latest/latin-wght-normal.woff2', 'body'],
          ['f', 'Lora', 'https://cdn.jsdelivr.net/fontsource/fonts/lora:vf@latest/latin-wght-normal.woff2', 'title'],
          ['title', 'Profile Theme'],
          ['alt', 'Active profile theme']
        ]
      };

      const parsed = parseThemeEvent(event);
      expect(parsed).toEqual({
        background: '#1c1515',
        text: '#ffffff',
        primary: '#ee5b2b',
        fonts: [
          {
            family: 'Lora',
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/lora:vf@latest/latin-wght-normal.woff2',
            role: 'body'
          },
          {
            family: 'Lora',
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/lora:vf@latest/latin-wght-normal.woff2',
            role: 'title'
          }
        ],
        backgroundMedia: null,
        title: 'Profile Theme'
      });
    });

    it('parses background media tag correctly', () => {
      const event = {
        kind: 36767,
        tags: [
          ['d', 'retro-stars'],
          ['c', '#000000', 'background'],
          ['c', '#ffffff', 'text'],
          ['c', '#00ff00', 'primary'],
          ['bg', 'url https://example.com/stars.png', 'mode tile', 'm image/png']
        ]
      };

      const parsed = parseThemeEvent(event);
      expect(parsed.backgroundMedia).toEqual({
        url: 'https://example.com/stars.png',
        mode: 'tile',
        mime: 'image/png',
        dim: null,
        blurhash: null
      });
    });

    it('resolves referenced 36767 event via a tag', () => {
      const kind16767 = {
        kind: 16767,
        tags: [
          ['a', '36767:pubkey123:my-theme']
        ]
      };

      const kind36767 = {
        kind: 36767,
        tags: [
          ['d', 'my-theme'],
          ['c', '#101010', 'background'],
          ['c', '#fafafa', 'text'],
          ['c', '#ff5500', 'primary']
        ]
      };

      const map = new Map([['36767:pubkey123:my-theme', kind36767]]);
      const parsed = parseThemeEvent(kind16767, map);
      expect(parsed.background).toBe('#101010');
      expect(parsed.primary).toBe('#ff5500');
    });

    it('returns null for empty or invalid event', () => {
      expect(parseThemeEvent(null)).toBeNull();
      expect(parseThemeEvent({ kind: 16767, tags: [] })).toBeNull();
    });
  });

  describe('generateThemeCss', () => {
    it('generates font-face and css variables', () => {
      const theme = {
        background: '#1c1515',
        text: '#ffffff',
        primary: '#ee5b2b',
        fonts: [
          {
            family: 'Lora',
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/lora.woff2',
            role: 'body'
          }
        ],
        title: 'Profile Theme'
      };

      const css = generateThemeCss(theme);
      expect(css).toContain('@font-face');
      expect(css).toContain('font-family: "Lora"');
      expect(css).toContain('--bg: #1c1515');
      expect(css).toContain('--text: #ffffff');
      expect(css).toContain('--primary: #ee5b2b');
      expect(css).toContain('--font-body: "Lora"');
    });
  });
});
