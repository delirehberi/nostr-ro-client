export function getKindLabel(kind) {
  switch (kind) {
    case 0:
      return '👤 Profile Metadata';
    case 1:
      return '💬 Note';
    case 3:
      return '👥 Follow List';
    case 6:
    case 16:
      return '🔁 Repost';
    case 7:
      return '❤️ Reaction';
    case 20:
      return '🖼️ Photo';
    case 21:
    case 22:
      return '📹 Video';
    case 1063:
      return '📁 File Metadata';
    case 1111:
      return '💬 Comment';
    case 1337:
    case 31337:
      return '💻 Code Snippet';
    case 1617:
      return '💻 Git Patch (NIP-34)';
    case 1618:
      return '🔀 Git Pull Request (NIP-34)';
    case 1621:
      return '❗ Git Issue (NIP-34)';
    case 1622:
      return '💬 Git Review / Comment';
    case 1630:
      return '🟢 Git Status: Open';
    case 1631:
      return '🟣 Git Status: Applied';
    case 1632:
      return '🔴 Git Status: Closed';
    case 1633:
      return '⚪ Git Status: Draft';
    case 1985:
      return '⭐ Label / Review';
    case 9802:
      return '💡 Highlight';
    case 10000:
      return '🔇 Mute List';
    case 10001:
      return '📌 Pinned Notes';
    case 10002:
      return '📡 Relay List (NIP-65)';
    case 10003:
      return '🔖 Bookmarks';
    case 10004:
      return '🌐 Communities';
    case 10005:
      return '💬 Public Chats';
    case 10006:
      return '🚫 Blocked Relays';
    case 10007:
      return '🔍 Search Relays';
    case 10015:
      return '🎯 Interests List';
    case 10017:
      return '💻 Git Follow List';
    case 10030:
      return '😀 Custom Emojis';
    case 10050:
      return '📬 DM Relays';
    case 10073:
      return '🎙️ Media Relays';
    case 10074:
      return '🌸 Blossom Servers';
    case 16767:
    case 36767:
      return '🎨 Theme Setting';
    case 30000:
      return '👥 People Set';
    case 30001:
      return '📋 Curated Set';
    case 30002:
      return '📡 Relay Set';
    case 30003:
      return '🔖 Bookmark Set';
    case 30004:
      return '✍️ Article Curation';
    case 30005:
      return '📹 Video Curation';
    case 30023:
    case 30024:
      return '✍️ Long-form Article';
    case 30040:
    case 30041:
      return '📚 Bookstr Publication';
    case 30617:
      return '💻 Git Repository (NIP-34)';
    case 30618:
      return '📦 Repository State (NIP-34)';
    case 31922:
    case 31923:
      return '🎬 Media Tracker';
    case 31989:
      return '⭐ App Recommendation';
    case 31990:
      return '📱 Nostr App (NIP-89)';
    case 31985:
      return '⭐ Review / Rating';
    default:
      if (kind >= 10000 && kind < 20000) return `📋 List (Kind ${kind})`;
      if (kind >= 30000 && kind < 40000) return `⚙️ App Data (Kind ${kind})`;
      return `Kind ${kind}`;
  }
}
