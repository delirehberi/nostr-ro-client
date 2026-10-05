import { vi } from 'vitest';

/**
 * Install a fake global WebSocket. `script(url, filter, socket)` runs after the
 * client sends its REQ and can reply through `socket.emit(frame)`.
 */
export function installMockWebSocket(script) {
  const sockets = [];

  class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.closed = false;
      sockets.push(this);
      queueMicrotask(() => this.onopen && this.onopen());
    }

    send(raw) {
      const frame = JSON.parse(raw);
      this.sent.push(frame);
      this.subId = frame[1];
      queueMicrotask(() => script && script(this.url, frame[2], this));
    }

    emit(frame) {
      this.onmessage && this.onmessage({ data: JSON.stringify(frame) });
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      this.onclose && this.onclose();
    }
  }

  vi.stubGlobal('WebSocket', MockWebSocket);
  return sockets;
}
