import { useState, useEffect } from 'react';
import { parseThemeEvent, generateThemeCss } from '../theme.js';
import { queryRelays } from '../relayClient.js';

const STYLE_ELEMENT_ID = 'nostr-dynamic-theme';

/**
 * Fetch the theme definition (kind 36767) a kind 16767 event points at, if any.
 * Returns a map keyed by the referencing tag value, as parseThemeEvent expects.
 */
async function fetchReferencedTheme(activeEvent, relays) {
  const referenced = new Map();

  const aTag = activeEvent.tags.find((t) => t[0] === 'a' && t[1]);
  if (aTag) {
    const [kind, author, ...dParts] = aTag[1].split(':');
    if (kind === '36767' && author) {
      const { events } = await queryRelays(
        relays,
        { kinds: [36767], authors: [author], '#d': [dParts.join(':')], limit: 5 },
        { timeout: 3000, subPrefix: 'thmref' }
      );
      events.sort((a, b) => b.created_at - a.created_at);
      if (events[0]) referenced.set(aTag[1], events[0]);
    }
    return referenced;
  }

  const eTag = activeEvent.tags.find((t) => t[0] === 'e' && t[1]);
  if (eTag) {
    const { events } = await queryRelays(
      relays,
      { ids: [eTag[1]], kinds: [36767] },
      { timeout: 3000, subPrefix: 'thmref' }
    );
    if (events[0]) referenced.set(eTag[1], events[0]);
  }
  return referenced;
}

export function useTheme(pubkey, relays = []) {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    if (!pubkey || relays.length === 0) return;

    let isMounted = true;
    const filter = {
      kinds: [16767],
      authors: [pubkey],
      limit: 5,
    };

    (async () => {
      const { events: themeEvents } = await queryRelays(relays, filter, { timeout: 3000, subPrefix: 'thm' });
      if (!isMounted || themeEvents.length === 0) return;
      themeEvents.sort((a, b) => b.created_at - a.created_at);
      const activeThemeEvent = themeEvents[0];

      const referenced = await fetchReferencedTheme(activeThemeEvent, relays);
      if (!isMounted) return;

      const parsed = parseThemeEvent(activeThemeEvent, referenced);
      if (parsed) {
        setTheme(parsed);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [pubkey, relays]);

  useEffect(() => {
    if (!theme) return;
    const themeCss = generateThemeCss(theme);
    if (!themeCss) return;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ELEMENT_ID;
    styleEl.textContent = themeCss;
    document.head.appendChild(styleEl);

    return () => styleEl.remove();
  }, [theme]);

  return theme;
}

export default useTheme;
