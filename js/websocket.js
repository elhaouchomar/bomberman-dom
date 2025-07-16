let domaineName = window.location.hostname
export let socket = new WebSocket(`ws:${domaineName}:8081`);
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
  
  console.log(socket);
  socket.onopen = () => {
    // console.log('a new connection is established in frontend');
    
    socket.send(JSON.stringify({ type: 'join', payload: { nickname } }));
  };
  socket.onmessage = (event) => {
    // console.log('message received from backend');
    try {
      const msg = JSON.parse(event.data);
      // console.log('message received from backend', msg);
      if (msg.type === 'state') {
        onStateCb && onStateCb(msg.payload);
      } else if (msg.type === 'playerId') {
        // console.log("onPlayerIdCb", onPlayerIdCb(msg.payload));
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
  socket.onerror = (err) => {
    onError && onError('WebSocket error');
  };
  socket.onclose = () => {

    onError && onError('Connection closed');
  };
}

export function sendChat(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'chat', payload: { message } }));
  }
}

window.sendAction = function (action) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'action', payload: action }));
  }
};
