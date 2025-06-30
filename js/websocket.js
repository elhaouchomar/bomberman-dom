export class WebSocketClient {
    constructor() {
        this.ws = null;
        this.messageHandlers = new Map();
    }

    connect(nickname) {
        this.ws = new WebSocket('ws://localhost:8080');

        this.ws.onopen = () => {
            console.log('WebSocket connection established');
            this.send('join', { nickname });
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (this.messageHandlers.has(message.type)) {
                    this.messageHandlers.get(message.type).forEach(handler => handler(message.payload));
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', { message: 'WebSocket connection error' });
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            this.emit('close', { message: 'Connection to server lost' });
        };
    }

    on(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
    }

    emit(event, data) {
        const handlers = this.messageHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type, payload });
            this.ws.send(message);
        } else {
            console.error('WebSocket is not connected.');
        }
    }
} 