import { encodeNaddr } from '../nip19.js';
import { getTagValue } from '../tags.js';

/** Code snippet context (kinds 1337/31337), or null. */
export function buildSnippetContext(event, ctx) {
  const { tags, dTag, title, summary } = ctx;
  // Code Snippet Context (Kind 1337 / 31337 / NIP-CO)
  let snippetContext = null;
  if (event.kind === 1337 || event.kind === 31337) {
    const rawTitle = title || getTagValue(tags, 'name') || dTag || 'code-snippet';
    const language = getTagValue(tags, 'l') || getTagValue(tags, 'extension') || (rawTitle.includes('.') ? rawTitle.split('.').pop() : 'code');
    const snippetDesc = summary || getTagValue(tags, 'description') || '';
    const snippetNaddr = event.kind === 31337 ? encodeNaddr(event.pubkey, event.kind, dTag) : null;
    
    snippetContext = {
      isSnippet: true,
      title: rawTitle,
      language: language.toLowerCase(),
      description: snippetDesc,
      naddr: snippetNaddr,
      snipsUrl: `https://snips.emre.xyz/#/s/${event.id}`
    };
  }
  return snippetContext;
}
