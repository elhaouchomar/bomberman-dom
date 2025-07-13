let ws = null;
let onStateCb = null;
let onPlayerIdCb = null;
let onChatCb = null;
let onPlayerListCb = null;
let onCountdownCb = null;
let onGameStartCb = null;
let onWaitingCb = null;
let onWinnerCb = null;

export function connectWebSocket({ nickname, onState, onPlayerId, onChat, onPlayerList, onCountdown, onGameStart, onWaiting, onError, onWinner }) {
  onStateCb = onState;
  onPlayerIdCb = onPlayerId;
  onChatCb = onChat;
  onPlayerListCb = onPlayerList;
  onCountdownCb = onCountdown;
  onGameStartCb = onGameStart;
  onWaitingCb = onWaiting;
  onWinnerCb = onWinner;
  ws = new WebSocket('ws://10.1.19.2:8081');

  ws.onopen = () => {
    console.log('a new connection is established in frontend');
    
    ws.send(JSON.stringify({ type: 'join', payload: { nickname } }));
  };
  ws.onmessage = (event) => {
    console.log('message received from backend');
    try {
      const msg = JSON.parse(event.data);
      console.log('message received from backend', msg);
      if (msg.type === 'state') {
        onStateCb && onStateCb(msg.payload);
      } else if (msg.type === 'playerId') {
        console.log("onPlayerIdCb", onPlayerIdCb(msg.payload));
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
      } else if (msg.type === 'winner') {
        onWinnerCb && onWinnerCb(msg.payload);
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
