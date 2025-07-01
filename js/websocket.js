export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.handlers = new Map(); 
  }

  connect(nickname) {
    
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.onopen = () => {
      console.log('WebSocket OPEN');
      this.send('join', { nickname });
    };

    this.ws.onmessage = async (event) => {
      try {
        let jsonText;
        if (event.data instanceof Blob) {
          jsonText = await event.data.text();
        } else {
          jsonText = event.data;
        }
        const msg = JSON.parse(jsonText);

        (this.handlers.get(msg.type) || []).forEach(fn => fn(msg.payload));
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };

    this.ws.onerror = err => {
      console.error('WebSocket error:', err);
      this.emit('error', { message: 'WebSocket error' });
    };

    this.ws.onclose = () => {
      console.warn('WebSocket CLOSED');
      this.emit('close', { message: 'Connection closed' });
    };
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }
  emit(type, payload) {
    (this.handlers.get(type) || []).forEach(fn => fn(payload));
  }

  send(type, payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.error('WebSocket not OPEN');
    }
  }
}
