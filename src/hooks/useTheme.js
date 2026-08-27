import { useState, useEffect } from 'react';
import { parseThemeEvent, generateThemeCss } from '../theme.js';

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

    const themeEvents = [];
    const fetchPromises = relays.map((relayUrl) => {
      return new Promise((resolve) => {
        let ws;
        const subId = 'thm_' + Math.random().toString(36).slice(2, 6);
        const timer = setTimeout(() => {
          if (ws) {
            try {
              ws.close();
            } catch (_) {}
          }
          resolve();
        }, 3000);

        try {
          ws = new WebSocket(relayUrl);
          ws.onopen = () => {
            try {
              ws.send(JSON.stringify(['REQ', subId, filter]));
            } catch (_) {
              resolve();
            }
          };
          ws.onmessage = (msg) => {
            try {
              const data = JSON.parse(msg.data);
              if (data[0] === 'EVENT' && data[2]) {
                themeEvents.push(data[2]);
              } else if (data[0] === 'EOSE' || data[0] === 'CLOSED') {
                clearTimeout(timer);
                try {
                  ws.close();
                } catch (_) {}
                resolve();
              }
            } catch (_) {}
          };
          ws.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
          ws.onclose = () => {
            clearTimeout(timer);
            resolve();
          };
        } catch (_) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    Promise.all(fetchPromises).then(() => {
      if (!isMounted || themeEvents.length === 0) return;
      themeEvents.sort((a, b) => b.created_at - a.created_at);
      const activeThemeEvent = themeEvents[0];
      const parsed = parseThemeEvent(activeThemeEvent, new Map());
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
