import { useState, useEffect } from 'react';
import { parseThemeEvent, generateThemeCss } from '../theme.js';
import { queryRelays } from '../relayClient.js';

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

    queryRelays(relays, filter, { timeout: 3000, subPrefix: 'thm' }).then(({ events: themeEvents }) => {
      if (!isMounted || themeEvents.length === 0) return;
      themeEvents.sort((a, b) => b.created_at - a.created_at);
      const parsed = parseThemeEvent(themeEvents[0], new Map());
      if (parsed) {
        setTheme(parsed);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pubkey, relays]);

  useEffect(() => {
    if (!theme) return;
    const themeCss = generateThemeCss(theme);
    if (!themeCss) return;

    let styleEl = document.getElementById('nostr-dynamic-theme');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'nostr-dynamic-theme';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = themeCss;
  }, [theme]);

  return theme;
}

export default useTheme;
