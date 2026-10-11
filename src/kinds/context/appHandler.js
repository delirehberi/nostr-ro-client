import { encodeNaddr } from '../nip19.js';
import { getAllTagValues, getTagValue } from '../tags.js';

/** NIP-89 application handler context (kinds 31990/31989), or null. */
export function buildAppHandlerContext(event, ctx) {
  const { tags, content, dTag, title, summary, image } = ctx;
  // NIP-89 Application Handler Context (Kind 31990 / 31989)
  let appHandlerContext = null;
  if (event.kind === 31990 || event.kind === 31989) {
    let appMeta = {};
    if (content && typeof content === 'string' && content.trim().startsWith('{')) {
      try {
        appMeta = JSON.parse(content);
      } catch (_) {}
    }

    const appName = appMeta.name || getTagValue(tags, 'name') || title || dTag || 'Nostr App';
    const appAbout = appMeta.about || appMeta.description || getTagValue(tags, 'about') || getTagValue(tags, 'description') || summary || '';
    const appPicture = appMeta.picture || appMeta.image || appMeta.logo || getTagValue(tags, 'picture') || getTagValue(tags, 'image') || image || null;
    const appWebsite = appMeta.website || getTagValue(tags, 'website') || getTagValue(tags, 'web') || null;
    const appNip05 = appMeta.nip05 || getTagValue(tags, 'nip05') || null;
    const appBanner = appMeta.banner || getTagValue(tags, 'banner') || null;
    const supportedKinds = getAllTagValues(tags, 'k').map((k) => parseInt(k, 10)).filter((k) => !isNaN(k));
    const appNaddr = encodeNaddr(event.pubkey, event.kind, dTag);

    appHandlerContext = {
      isAppHandler: true,
      name: appName,
      about: appAbout,
      picture: appPicture,
      website: appWebsite,
      nip05: appNip05,
      banner: appBanner,
      supportedKinds,
      naddr: appNaddr,
      nostrhubUrl: appNaddr ? `https://nostrhub.io/a/${appNaddr}` : `https://nostrhub.io/a/${event.id}`
    };
  }
  return appHandlerContext;
}
