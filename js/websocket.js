import store from '../framework/state.js';

let socket = null;
export { socket };

let lastNickname = '';
let lastRoomId   = null;  

function wsURL() {
  const host = window.location.hostname || 'localhost';
  return `ws://${host}:8081/`;
}

function openSocket() {
  socket = new WebSocket(wsURL());
  console.log('[WS] connecting to', wsURL());

  socket.onopen = () => {
    console.log('[WS] connected');
    if (lastNickname) {
      const payload = { nickname: lastNickname };
      if (lastRoomId) payload.roomId = lastRoomId;
      socket.send(JSON.stringify({ type: 'join', payload }));
    }
  };

  socket.onmessage = handleMessage;

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
      break;
    }

    case 'winner': {
      store.setState({
        winner: payload,
        screen: 'waiting',
        gameStarted: false,
        error: ''
      });
      break;
    }

    case 'error': {
      store.setState({ error: payload.message });
      break;
    }
  }
}
