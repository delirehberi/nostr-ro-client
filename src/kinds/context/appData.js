/** NIP-78 application data context, or null. */
export function buildAppDataContext(event, ctx) {
  const { content, dTag, title } = ctx;
  // App Data Context (Kind 30078 / NIP-78 and app configs)
  const isAppDataKind = event.kind === 30078 || (event.kind >= 30000 && event.kind < 40000 && event.kind !== 31990 && event.kind !== 30617 && event.kind !== 30618 && (dTag.includes('metadata') || dTag.includes('settings') || dTag.includes('state') || dTag.includes('config') || dTag.includes('data')));
  const isBase64Blob = typeof content === 'string' && /^[A-Za-z0-9+/=\s]{40,}$/.test(content.trim()) && !content.trim().includes(' ');
  const isJsonBlob = typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('[')) && content.trim().length > 40;
  const isEncryptedOrRaw = isBase64Blob || isJsonBlob;

  let appContext = null;
  if (isAppDataKind || event.kind === 30078) {
    const rawAppName = dTag ? dTag.split(/[:\-_/]/)[0] : (title ? title.split(/[:\s]/)[0] : 'App');
    const appName = rawAppName ? rawAppName.charAt(0).toUpperCase() + rawAppName.slice(1) : 'Application';
    appContext = {
      isAppData: true,
      appName,
      identifier: dTag || title || `Kind ${event.kind}`,
      isEncryptedOrRaw,
      description: `Application configuration and state data stored on Nostr (NIP-78).`
    };
  }
  return appContext;
}
