import { encodeNaddr, encodeNpub } from '../nip19.js';
import { getAllTagValues, getTagValue } from '../tags.js';

/** NIP-34 git context and the repository a post refers to: `{ gitContext, repoContext }`. */
export function buildGitContexts(event, ctx) {
  const { tags, content, dTag, title } = ctx;
  // Repository & Git Context (NIP-34 Git events & repo references)
  const isGitKind = event.kind === 1617 || event.kind === 1618 || event.kind === 1621 || event.kind === 1622 || (event.kind >= 1630 && event.kind <= 1633) || event.kind === 30617 || event.kind === 30618;
  const repoATags = tags.filter((t) => Array.isArray(t) && t[0] === 'a' && t[1] && t[1].startsWith('30617:'));
  const repoATag = repoATags[0] || null;
  const ghTag = tags.find((t) => Array.isArray(t) && (t[0] === 'r' || t[0] === 'i' || t[0] === 'u') && t[1] && t[1].includes('github.com/'));

  let repoContext = null;
  let gitContext = null;

  if (isGitKind || repoATag) {
    let repoName = dTag || title || 'Repository';
    let repoPubkey = event.pubkey;
    let repoIdentifier = dTag || '';

    if (repoATag) {
      const parts = repoATag[1].split(':');
      repoPubkey = parts[1] || repoPubkey;
      repoIdentifier = parts.slice(2).join(':') || repoIdentifier;
      repoName = repoIdentifier || repoName;
    }

    const repoNaddr = encodeNaddr(repoPubkey, 30617, repoIdentifier);
    const eventNaddr = (event.kind >= 30000 && event.kind < 40000) ? encodeNaddr(event.pubkey, event.kind, dTag) : null;
    const authorNpub = encodeNpub(event.pubkey);
    const repoOwnerNpub = encodeNpub(repoPubkey);

    const gitworkshopRepoUrl = repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}` : (repoPubkey && repoIdentifier ? `https://gitworkshop.dev/${repoOwnerNpub}/${repoIdentifier}` : null);
    
    let gitworkshopUrl = null;
    if (event.kind === 30617 || event.kind === 30618) {
      gitworkshopUrl = (eventNaddr ? `https://gitworkshop.dev/r/${eventNaddr}` : null) || gitworkshopRepoUrl;
    } else if (event.kind === 1618) {
      gitworkshopUrl = repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}/pulls/${event.id}` : `https://gitworkshop.dev/p/${event.id}`;
    } else if (event.kind === 1621) {
      gitworkshopUrl = repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}/issues/${event.id}` : `https://gitworkshop.dev/p/${event.id}`;
    } else if (event.kind === 1617) {
      gitworkshopUrl = `https://gitworkshop.dev/p/${event.id}`;
    } else {
      gitworkshopUrl = gitworkshopRepoUrl || `https://gitworkshop.dev/p/${event.id}`;
    }

    // Extract commits, branches, clone URLs, web URLs, relays
    const cloneUrls = getAllTagValues(tags, 'clone');
    const webUrls = getAllTagValues(tags, 'web');
    const relayUrls = [...getAllTagValues(tags, 'relays'), ...getAllTagValues(tags, 'server')];
    const maintainers = getAllTagValues(tags, 'maintainers');

    // Extract commit hashes (from commit tags, r tags, HEAD refs, or 40-char hex in content/tags)
    const commitHashes = new Set();
    tags.forEach((t) => {
      if (!Array.isArray(t)) return;
      const tagKey = t[0];
      const tagVal = t[1];
      if (tagKey === 'commit' && tagVal && /^[0-9a-f]{7,40}$/i.test(tagVal)) {
        commitHashes.add(tagVal);
      } else if (tagKey === 'r' && tagVal && /^[0-9a-f]{40}$/i.test(tagVal)) {
        commitHashes.add(tagVal);
      } else if (tagKey.startsWith('refs/heads/') && tagVal && /^[0-9a-f]{40}$/i.test(tagVal)) {
        commitHashes.add(tagVal);
      }
    });

    const commitBadges = Array.from(commitHashes).map((hash) => ({
      hash,
      shortHash: hash.slice(0, 7),
      url: repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}/commit/${hash}` : `https://gitworkshop.dev/r/${hash}`
    }));

    // Extract branch
    let branch = getTagValue(tags, 'branch');
    const headTag = getTagValue(tags, 'HEAD');
    if (!branch && headTag) {
      const match = headTag.match(/refs\/heads\/(.+)$/);
      if (match) branch = match[1];
    }
    if (!branch) {
      const refTag = tags.find((t) => Array.isArray(t) && t[0].startsWith('refs/heads/'));
      if (refTag) {
        branch = refTag[0].replace('refs/heads/', '');
      }
    }

    // Extract PR/Issue subject or title
    let subject = title || getTagValue(tags, 'subject') || getTagValue(tags, 'name') || '';
    if (!subject && content) {
      const prMatch = content.match(/^git\s+Pull\s+Request:\s*(.+)$/im);
      if (prMatch) {
        subject = prMatch[1].trim();
      } else if (!title) {
        const firstLine = content.split('\n')[0].trim();
        if (firstLine && firstLine.length < 80) subject = firstLine;
      }
    }

    gitContext = {
      isGit: true,
      kind: event.kind,
      repoName,
      repoPubkey,
      repoIdentifier,
      repoNaddr,
      repoOwnerNpub,
      gitworkshopRepoUrl,
      gitworkshopUrl,
      authorNpub,
      cloneUrls,
      webUrls,
      relayUrls,
      maintainers,
      commitBadges,
      branch,
      subject: subject || repoName
    };

    repoContext = {
      type: 'nip34',
      name: repoName,
      coordinate: repoATag ? repoATag[1] : (eventNaddr || repoName),
      pubkey: repoPubkey,
      title: subject || repoName,
      url: gitworkshopUrl
    };
  } else if (ghTag) {
    const ghUrl = ghTag[1];
    const ghMatch = ghUrl.match(/github\.com\/([^/]+\/[^/]+)(?:\/(?:blob|tree|issues|pull)\/[^/]+\/(.+)|(?:\/(?:blob|tree|issues|pull)\/(.+)))?/i);
    if (ghMatch) {
      const repo = ghMatch[1];
      const filePath = ghMatch[2] || ghMatch[3] || '';
      repoContext = {
        type: 'github',
        url: ghUrl,
        repo,
        path: filePath,
        name: repo,
        title: filePath ? `${repo}: ${filePath.split('/').pop()}` : repo
      };
    } else {
      repoContext = {
        type: 'url',
        url: ghUrl,
        name: ghUrl.replace(/^https?:\/\/(?:www\.)?/, ''),
        title: ghUrl
      };
    }
  }
  return { gitContext, repoContext };
}
