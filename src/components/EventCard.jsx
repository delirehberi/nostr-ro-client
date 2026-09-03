import React from 'react';
import { classifyEvent } from '../kinds.js';
import { SimpleTextPostComponent } from './SimpleTextPostComponent.jsx';
import { MovieComponent } from './MovieComponent.jsx';
import { BookComponent } from './BookComponent.jsx';
import { ArticleComponent } from './ArticleComponent.jsx';
import { MediaComponent } from './MediaComponent.jsx';
import { ListComponent } from './ListComponent.jsx';
import { HighlightComponent } from './HighlightComponent.jsx';
import { GenericComponent } from './GenericComponent.jsx';
import { GitEventComponent } from './GitEventComponent.jsx';
import { AppHandlerComponent } from './AppHandlerComponent.jsx';
import { SnippetComponent } from './SnippetComponent.jsx';
import { ReactionComponent } from './ReactionComponent.jsx';

export function EventCard({ event, profileMap, eventMap }) {
  if (!event) return null;

  const { category, subCategory } = classifyEvent(event);
  const kind = event.kind;

  let innerComponent = null;

  // Direct Kind Matching for Specialized Ecosystem Cards
  if (kind === 7) {
    innerComponent = (
      <ReactionComponent
        event={event}
        profileMap={profileMap}
        eventMap={eventMap}
      />
    );
  } else if (kind === 31990 || kind === 31989) {
    innerComponent = (
      <AppHandlerComponent
        event={event}
        profileMap={profileMap}
      />
    );
  } else if (kind === 1337 || kind === 31337) {
    innerComponent = (
      <SnippetComponent
        event={event}
        profileMap={profileMap}
      />
    );
  } else if (
    kind === 1617 ||
    kind === 1618 ||
    kind === 1621 ||
    kind === 1622 ||
    (kind >= 1630 && kind <= 1633) ||
    kind === 30617 ||
    kind === 30618
  ) {
    innerComponent = (
      <GitEventComponent
        event={event}
        profileMap={profileMap}
        eventMap={eventMap}
      />
    );
  } else {
    switch (category) {
      case 'notes':
        innerComponent = (
          <SimpleTextPostComponent
            event={event}
            profileMap={profileMap}
            eventMap={eventMap}
          />
        );
        break;
      case 'movies':
        innerComponent = (
          <MovieComponent event={event} profileMap={profileMap} />
        );
        break;
      case 'books':
        innerComponent = (
          <BookComponent event={event} profileMap={profileMap} />
        );
        break;
      case 'articles':
        innerComponent = <ArticleComponent event={event} profileMap={profileMap} />;
        break;
      case 'media':
        innerComponent = (
          <MediaComponent event={event} profileMap={profileMap} />
        );
        break;
      case 'lists':
        innerComponent = (
          <ListComponent event={event} profileMap={profileMap} />
        );
        break;
      case 'highlights':
        innerComponent = <HighlightComponent event={event} />;
        break;
      default:
        innerComponent = (
          <GenericComponent event={event} profileMap={profileMap} />
        );
    }
  }

  return (
    <div
      className="post event-card"
      data-id={event.id}
      data-kind={event.kind}
      data-category={category}
      data-sub-category={subCategory}
      data-created-at={event.created_at}
    >
      {innerComponent}
    </div>
  );
}

export default EventCard;
