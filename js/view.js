import { createVNode } from '../framework/core.js';
import store from '../framework/state.js';
import { socket } from './websocket.js'; // path relative to view.js
import { renderGame } from './renderer.js';

document.body.addEventListener('click', (e) => {
  console.log(e.target.id);
  if (e.target.id === 'restart-btn') {
    socket.send(JSON.stringify({ type: 'restart' }));
    // Optionally, update state/UI if you want to show a loading state, etc.
    store.setState({ screen: 'waiting', error: '' });
  }
});

document.body.addEventListener('keyup', (e) => {
    console.log(e.target.value);
    
  if (e.target.id === 'nickname-input' && e.key === 'Enter') {
    document.getElementById('join-btn').click();
  }

  if (e.target.id === 'chat-input' && e.key === 'Enter') {
    document.getElementById('chat-send').click();
  }
});

export function AppView(state) {
    console.log(state);
  return createVNode('div', {class: 'app'}, [
    state.screen === 'nickname' && NicknameScreen(state),
    state.screen === 'waiting' && WaitingScreen(state),
    state.screen === 'game' && GameScreen(state),
    // ChatOverlay(state),
    // ErrorBanner(state)
  ]);
}

function NicknameScreen(state) {
  return createVNode('div', { class: 'screen', id: 'nickname-screen', style: `display:${state.screen === 'nickname' ? 'block' : 'none'}` }, [
    createVNode('h1', {}, '🎮 BOMBERMAN DOM'),
    createVNode('input', { id: 'nickname-input', class: 'nickname-input', type: 'text', placeholder: 'Enter your nickname', maxlength: 15, value: state.nickname }),
    createVNode('button', { id: 'join-btn', class: 'btn' }, 'Join Game')
  ]);
}

function WaitingScreen(state) {
  return createVNode('div', { class: 'screen', id: 'waiting-screen', style: `display:${state.screen === 'waiting' ? 'block' : 'none'}` }, [
    createVNode('h2', {}, 'Waiting for Players…'),
    createVNode('div', { id: 'player-counter', class: 'player-counter' }, `Players: ${state.playerCount}/4`),
    createVNode('div', { id: 'countdown', class: 'countdown' }, 
      state.waitingTime > 0 ? `Waiting for more players... ${state.waitingTime}s` : `Starting Game... ${state.countdown}s`),
    createVNode('div', { class: 'chat-overlay' }, [
    createVNode('div', { id: 'chat-messages', class: 'chat-messages' }, state.chatMessages.map(msg =>
      createVNode('div', {}, `${msg.nickname}: ${msg.message}`)
    )),
    createVNode('div', { class: 'chat-input-container' }, [
      createVNode('input', { id: 'chat-input', class: 'chat-input', type: 'text', placeholder: 'Type message…' }),
      createVNode('button', { id: 'chat-send', class: 'chat-send' }, 'Send')
      ])
    ])
  ]);
}

function GameScreen(state) {
  return createVNode('div', {
    class: 'screen',
    id: 'game-screen',
    style: `display:${state.screen === 'game' ? 'block' : 'none'}`
  }, [
    renderGame(state.gameState, state.playerId)
  ]);
}

function ChatOverlay(state) {
  return createVNode('div', { class: 'chat-overlay', style: `display:${state.chatVisible ? 'flex' : 'none'}` }, [
    createVNode('div', { id: 'chat-messages', class: 'chat-messages' }, state.chatMessages.map(msg =>
      createVNode('div', {}, `${msg.nickname}: ${msg.message}`)
    )),
    createVNode('div', { class: 'chat-input-container' }, [
      createVNode('input', { id: 'chat-input', class: 'chat-input', type: 'text', placeholder: 'Type message…' }),
      createVNode('button', { id: 'chat-send', class: 'chat-send' }, 'Send')
    ])
  ]);
}

function ErrorBanner(state) {
  return state.error
    ? createVNode('div', { class: 'error-banner' }, state.error)
    : null;
}

 // adjust path as needed

socket.onmessage = function(event) {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'playerId':
      // Server assigns a playerId after joining
      store.setState({ playerId: msg.payload });
      break;

    case 'playerList':
      // Update lobby player list and count
      store.setState({
        players: msg.payload,
        playerCount: msg.payload.length,
        error: ''
      });
      break;

    case 'waiting':
      // Waiting for more players
      store.setState({
        screen: 'waiting',
        waitingTime: msg.payload.waiting,
        chatVisible: true,
        error: ''
      });
      break;

    case 'countdown':
      // Countdown before game starts
      store.setState({
        screen: 'waiting',
        countdown: msg.payload.countdown,
        error: ''
      });
      break;

    case 'gameStart':
      // Game is starting
      store.setState({
        screen: 'game',
        gameStarted: true,
        chatVisible: true,
        error: ''
      });
      break;

    case 'state':
      // Full game state update (positions, bombs, etc.)
      store.setState({
        gameState: msg.payload,
        // Optionally update playerInfo if included in payload
        // playerInfo: msg.payload.playerInfo
      });
      break;

    case 'chat':
      // New chat message
      store.setState({
        chatMessages: [...store.getState().chatMessages, msg.payload],
        error: ''
      });
      break;

    case 'winner':
      // Game ended, show winner
      store.setState({
        winner: msg.payload,
        screen: '', // or a dedicated 'winner' screen if you want
        gameStarted: false,
        error: ''
      });
      break;

    case 'error':
      // Show error message
      store.setState({ error: msg.payload.message });
      break;

    default:
      // Handle any other message types as needed
      break;
  }
};

function showError(msg) {
  store.setState({ error: msg });
  setTimeout(() => store.setState({ error: '' }), 3000);
}

document.body.addEventListener('click', (e) => {
  if (e.target.id === 'chat-send') {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput ? chatInput.value.trim() : '';

    if (!message) {
      showError('Please enter a message.');
      return;
    }

    socket.send(JSON.stringify({
      type: 'chat',
      payload: { message }
    }));

    chatInput.value = '';
    store.setState({ error: '' });
  }
});

document.body.addEventListener('keydown', (e) => {
  if (e.target.id === 'chat-input' && e.key === 'Enter') {
    document.getElementById('chat-send').click();
  }
});

document.body.addEventListener('click', (e) => {
  if (e.target.id === 'join-btn') {
    console.log('Join button clicked!');
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput ? nicknameInput.value.trim() : '';

    if (!nickname) {
      store.setState({ error: 'Please enter a nickname.' });
      return;
    }

    store.setState({ nickname, error: '' });

    socket.send(JSON.stringify({
      type: 'join',
      payload: { nickname }
    }));
  }
});

document.body.addEventListener('keydown', (e) => {
  if (e.target.id === 'nickname-input' && e.key === 'Enter') {
    document.getElementById('join-btn').click();
  }
});