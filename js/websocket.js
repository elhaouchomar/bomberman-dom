import store from '../framework/state.js';
import { refs } from '../framework/core.js';

let socket = null;
export { socket };

let lastNickname = '';
let lastRoomId = null;

function wsURL() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/`;
}

function openSocket() {
  socket = new WebSocket(wsURL());
  socket.onopen = () => {
    if (lastNickname) {
      const payload = { nickname: lastNickname };
      if (lastRoomId) payload.roomId = lastRoomId;
      socket.send(JSON.stringify({ type: 'join', payload }));
    }
  };

  socket.onmessage = handleMessage;

  socket.onerror = (e) => {
    store.setState({ error: 'WebSocket error' });
  };

  socket.onclose = (e) => {
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
  }
}

function handleMessage(evt) {
  let msg;
  try { msg = JSON.parse(evt.data); } catch { return; }
  const { type, payload } = msg;

  switch (type) {
    case 'playerId': {
      // new payload: {playerId,playerNum?,roomId?} OR legacy string
      const pId = payload.playerId || payload;
      const roomId = payload.roomId || null;
      if (roomId) lastRoomId = roomId;
      store.setState({
        playerId: pId,
        screen: 'waiting',
        error: ''
      });
      break;
    }

    case 'playerList': {
      store.setState({
        players: payload,
        playerCount: payload.length,
        error: ''
      });
      break;
    }

    case 'waiting': {
      store.setState({
        screen: 'waiting',
        waitingTime: payload.waiting,
        chatVisible: true,
        error: ''
      });
      break;
    }

    case 'countdown': {
      store.setState({
        screen: 'waiting',
        countdown: payload.countdown,
        // waitingTime: 0,
        error: ''
      });
      break;
    }

    case 'gameStart': {
      store.setState({
        screen: 'game',
        gameStarted: true,
        chatVisible: true,
        error: ''
      });
      break;
    }

    case 'state': {
      store.setState({ gameState: payload });
      break;
    }

    case 'chat': {
      store.setState({
        chatMessages: [...store.getState().chatMessages, payload],
        error: ''
      });
      setTimeout(() => {
        const box = refs?.chatMessages;
        if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
      }, 0);
      break;
    }

    case 'restart': {
      store.setState({
        screen: 'nickname',
        error: '',
        winner: null,
        chatMessages: [] // Clear chat messages on restart
      });
      break;
    }
    case 'win': case 'lose': {
      store.setState({
        winner: payload,
        screen: 'winner',
        gameStarted: false,
        error: '',
        type: type
      });
      break;
    }

    case 'died': {
      store.setState({
        players: payload,
        type: type,
        winner: null,
        screen: 'winner',
        gameStarted: false,
        error: '',
      });
    }

    case 'error': {
      store.setState({ error: payload.message });
      break;
    }
  }
}
