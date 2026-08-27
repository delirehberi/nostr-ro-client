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

export function EventCard({ event, profileMap, eventMap }) {
  if (!event) return null;

  const { category, subCategory } = classifyEvent(event);

  let innerComponent = null;
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
