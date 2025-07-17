import { render } from '../framework/core.js';
import store from '../framework/state.js';
import { AppView, attachViewGlobalEvents } from './view.js';
// import { sendAction } from '../client/websocket.js';
// import { sendAction, socket } from './websocket.js';



let socket = null;
export { socket };

let lastNickname = '';
let lastRoomId = null;

function wsURL() {
  const host = window.location.hostname || 'localhost';
  return `ws://${host}:8081/`;
}

function openSocket() {
  socket = new WebSocket(wsURL());


  socket.onopen = () => {
    console.log('[WS] connected');
    if (lastNickname) {
      const payload = { nickname: lastNickname };
      if (lastRoomId) payload.roomId = lastRoomId;
      socket.send(JSON.stringify({ type: 'join', payload }));
    }
  };

  // socket.onmessage = handleMessage;

  socket.onerror = (e) => {
    console.warn('[WS] error', e);
    store.setState({ error: 'WebSocket error' });
  };

  socket.onclose = (e) => {
    console.warn('[WS] closed', e.code, 'clean=', e.wasClean);
    store.setState({ error: 'Connection lost', screen: 'nickname', gameStarted: false });
    setTimeout(() => {
      if (socket?.readyState !== WebSocket.OPEN) {
        openSocket();
      }
    }, 1000);
  };
}

openSocket();


export function sendJoin(nickname, roomId = null) {
  lastNickname = nickname;
  if (roomId) lastRoomId = roomId;
  safeSend({ type: 'join', payload: { nickname, roomId } });
}

export function sendChat(message) {
  safeSend({ type: 'chat', payload: { message } });
}

export function sendAction(action) {
  safeSend({ type: 'action', payload: action });
}

export function sendRestart() {
  safeSend({ type: 'restart' });
}

function safeSend(obj) {
  const str = JSON.stringify(obj);
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(str);
  } else {
    console.warn('[WS] send skipped; socket not open', obj);
  }
}


attachViewGlobalEvents();

// Keyboard controls
document.body.onkeydown = (e) => {

  if (store.getState().screen !== 'game') return;
  let payload = null;
  switch (e.key) {
    case 'ArrowUp': payload = { type: 'move', dx: 0, dy: -1 }; break;
    case 'ArrowDown': payload = { type: 'move', dx: 0, dy: 1 }; break;
    case 'ArrowLeft': payload = { type: 'move', dx: -1, dy: 0 }; break;
    case 'ArrowRight': payload = { type: 'move', dx: 1, dy: 0 }; break;
    case ' ': payload = { type: 'placeBomb' }; break;
    default: break;
  }
  if (payload) {


    sendAction(payload);
    e.preventDefault();
  }
};

// Render on state change
const root = document.body;
function rerender() {
  render(AppView(store.getState()), root);
}
store.subscribe(rerender);
rerender(); // Initial render


// 3. WebSocket message handler (already provided in previous answers)
socket.onmessage = function (event) {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'playerId':
      store.setState({ playerId: msg.payload });

      break;
    case 'playerList':
      store.setState({
        players: msg.payload,
        playerCount: msg.payload.length,
        error: ''
      });
      break;
    case 'waiting':
      store.setState({
        screen: 'waiting',
        waitingTime: msg.payload.waiting,
        chatVisible: true,
        error: ''
      });
      break;
    case 'countdown':
      store.setState({
        screen: 'waiting',
        countdown: msg.payload.countdown,
        error: ''
      });
      break;
    case 'gameStart':

      store.setState({
        screen: 'game',
        gameStarted: true,
        chatVisible: false,
        error: ''
      });

      break;
    case 'state':
      store.setState({
        gameState: msg.payload,
      });
      break;
    case 'chat':
      store.setState({
        chatMessages: [...store.getState().chatMessages, msg.payload],
        error: ''
      });
      break;
    case 'winner':

      store.setState({
        winner: msg.payload,
        screen: 'nickname',
        gameStarted: false,
        error: ''
      });
      break;
    case 'error':
      store.setState({ error: msg.payload.message });
      break;
    default:
      break;
  }
};
