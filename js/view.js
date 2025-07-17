import { createVNode } from '../framework/core.js';
import store from '../framework/state.js';
import { socket } from './main.js';
import { renderGame } from './renderer.js';


// Handle click events
export function attachViewGlobalEvents() {
document.body.onclick = (e) => {
  if (e.target.id === 'join-btn') {
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput ? nicknameInput.value.trim() : '';
    if (!nickname) {
      store.setState({ error: 'Please enter a nickname.' });
      return;
    }

    store.setState({ nickname, error: '' });
    socket.send(JSON.stringify({ type: 'join', payload: { nickname } }));
  }

  if (e.target.id === 'chat-send') {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    socket.send(JSON.stringify({ type: 'chat', payload: { message } }));
    input.value = '';
  }

  if (e.target.id === 'restart-btn') {
    socket.send(JSON.stringify({ type: 'restart' }));
    store.setState({ screen: 'waiting', error: '', winner: null });
  }
};

// Handle Enter key
document.body.onkeydown = (e) => {
  if (e.target.id === 'nickname-input' && e.key === 'Enter') {
    document.getElementById('join-btn').click();
  
  }
  if (e.target.id === 'chat-input' && e.key === 'Enter') {
    document.getElementById('chat-send').click();
  }
}
}

export function AppView(state) {
  return createVNode('div', { class: 'app' }, [
    state.screen === 'nickname' && NicknameScreen(state),
    state.screen === 'waiting' && WaitingScreen(state),
    state.screen === 'game' && GameScreen(state),
  ]);
}

function NicknameScreen(state) {
  return createVNode('div', { class: 'screen', id: 'nickname-screen' }, [
    createVNode('h1', {}, '🎮 BOMBERMAN DOM'),
    createVNode('input', {
      id: 'nickname-input',
      class: 'nickname-input',
      type: 'text',
      placeholder: 'Enter your nickname',
      maxlength: 15,
      value: state.nickname || ''
    }),
    createVNode('button', { id: 'join-btn', class: 'btn' }, 'Join Game'),
    ErrorBanner(state)
  ]);
}

function WaitingScreen(state) {
  return createVNode('div', {
    class: 'screen',
    id: 'waiting-screen',
    style: `display:${state.screen === 'waiting' ? 'block' : 'none'}`
  }, [
    createVNode('h2', {}, 'Waiting for Players…'),
    createVNode('div', { id: 'player-counter', class: 'player-counter' },
      `Players: ${state.playerCount}/4`
    ),
    createVNode('div', { id: 'countdown', class: 'countdown' },
      state.waitingTime > 0
        ? `Waiting for more players... ${state.waitingTime}s`
        : `Starting Game... ${state.countdown || 20}s`
    ),
    ChatOverlay(state),
    ErrorBanner(state)
  ]);
}

function GameScreen(state) {
  return createVNode('div', {
    class: 'screen',
    id: 'game-screen',
    style: `display:${state.screen === 'game' ? 'block' : 'none'}`,
  }, [
    renderGame(state.gameState, state.playerId),
    state.winner && WinnerBanner(state.winner)
  ]);
}

function ChatOverlay(state) {
  return createVNode('div', { class: 'chat-overlay' }, [
    createVNode('div', { id: 'chat-messages', class: 'chat-messages' },
      state.chatMessages.map(msg =>
        createVNode('div', {}, `${msg.nickname}: ${msg.message}`)
      )
    ),
    createVNode('div', { class: 'chat-input-container' }, [
      createVNode('input', {
        id: 'chat-input',
        class: 'chat-input',
        type: 'text',
        placeholder: 'Type message…'
      }),
      createVNode('button', { id: 'chat-send', class: 'chat-send' }, 'Send')
    ])
  ]);
}

function ErrorBanner(state) {
  return state.error
    ? createVNode('div', { class: 'error-banner' }, state.error)
    : null;
}

function WinnerBanner(nickname) {
  return createVNode('div', { class: 'winner-overlay' }, [
    createVNode('div', { class: 'winner-banner' }, `🏆 Winner: ${nickname}`),
    createVNode('button', { id: 'restart-btn', class: 'btn restart-btn' }, 'Restart Game')
  ]);
}
