let ws = null;
let onStateCb = null;
let onPlayerIdCb = null;
let onChatCb = null;
let onPlayerListCb = null;
let onCountdownCb = null;
let onGameStartCb = null;
let onWaitingCb = null;

export function connectWebSocket({ nickname, onState, onPlayerId, onChat, onPlayerList, onCountdown, onGameStart, onWaiting, onError }) {
  onStateCb = onState;
  onPlayerIdCb = onPlayerId;
  onChatCb = onChat;
  onPlayerListCb = onPlayerList;
  onCountdownCb = onCountdown;
  onGameStartCb = onGameStart;
  onWaitingCb = onWaiting;
  ws = new WebSocket('ws://localhost:8081');

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', payload: { nickname } }));
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'state') {
        onStateCb && onStateCb(msg.payload);
      } else if (msg.type === 'playerId') {
        onPlayerIdCb && onPlayerIdCb(msg.payload);
      } else if (msg.type === 'chat') {
        onChatCb && onChatCb(msg.payload);
      } else if (msg.type === 'playerList') {
        onPlayerListCb && onPlayerListCb(msg.payload);
      } else if (msg.type === 'countdown') {
        onCountdownCb && onCountdownCb(msg.payload);
      } else if (msg.type === 'gameStart') {
        onGameStartCb && onGameStartCb(msg.payload);
      } else if (msg.type === 'waiting') {
        onWaitingCb && onWaitingCb(msg.payload);
      } else if (msg.type === 'error') {
        onError && onError(msg.payload.message);
      }
    } catch (err) {
      onError && onError('Error parsing server message');
    }
  };
  ws.onerror = (err) => {
    onError && onError('WebSocket error');
  };
  ws.onclose = () => {
    onError && onError('Connection closed');
  };
}

export function sendChat(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', payload: { message } }));
  }
}

window.sendAction = function (action) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'action', payload: action }));
  }
};
