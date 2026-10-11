import { nip19 } from 'nostr-tools';

/** Events quoted via `q`/`e` tags or inline nostr: mentions. */
export function extractQuotes(event, ctx) {
  const { tags, content } = ctx;
  // Quoted events extraction
  const quotes = [];
  const quoteIds = new Set();

  // 1. Check 'q' tags and 'e' tags with mention marker
  tags.forEach((t) => {
    if (!Array.isArray(t)) return;
    if (t[0] === 'q' && t[1]) {
      quoteIds.add(t[1]);
      quotes.push({ id: t[1], relay: t[2] || null, pubkey: t[3] || null });
    } else if (t[0] === 'e' && t[1] && (t[3] === 'mention' || t[3] === 'quote')) {
      if (!quoteIds.has(t[1])) {
        quoteIds.add(t[1]);
        quotes.push({ id: t[1], relay: t[2] || null, pubkey: null });
      }
    }
  });

  // 2. Check content for inline mentions (nostr:nevent1..., nostr:note1..., [event:nevent1...])
  const quoteRegex = /(?:nostr:)?\b((?:nevent|note)1[0-9a-z]{20,})\b/g;
  let qMatch;
  while ((qMatch = quoteRegex.exec(content)) !== null) {
    const bech32 = qMatch[1];
    try {
      const decoded = nip19.decode(bech32);
      let targetId = null;
      let targetPubkey = null;
      if (decoded.type === 'note') {
        targetId = decoded.data;
      } else if (decoded.type === 'nevent') {
        targetId = decoded.data.id;
        targetPubkey = decoded.data.author || null;
      }
      if (targetId && !quoteIds.has(targetId) && targetId !== event.id) {
        quoteIds.add(targetId);
        quotes.push({ id: targetId, pubkey: targetPubkey, bech32 });
      }
    } catch (_) {}
  }
  return quotes;
}
