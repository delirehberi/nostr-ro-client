import React from 'react';

/**
 * Isolates render errors (cards parse untrusted tags/JSON) so one broken event
 * cannot blank the whole app.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Failed to render event card', error);
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? <div className="event-card-error">This event could not be displayed.</div>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
