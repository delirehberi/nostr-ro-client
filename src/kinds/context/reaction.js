import { getTagValue } from '../tags.js';

/** Reaction context (kind 7), or null. */
export function buildReactionContext(event, ctx) {
  const { tags, content } = ctx;
  // Reaction Context (Kind 7)
  let reactionContext = null;
  if (event.kind === 7) {
    const rawContent = (content || '+').trim();
    const targetEventId = getTagValue(tags, 'e');
    const targetAuthor = getTagValue(tags, 'p');
    const targetCoordinate = getTagValue(tags, 'a');

    reactionContext = {
      isReaction: true,
      reaction: rawContent || '+',
      targetEventId,
      targetAuthor,
      targetCoordinate
    };
  }
  return reactionContext;
}
