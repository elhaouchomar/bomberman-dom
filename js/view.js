// view.js  (no direct DOM queries, refs only)
import { createVNode } from '../framework/core.js';
import store from '../framework/state.js';
import { socket } from './websocket.js';
import { renderGame } from './renderer.js';
import { events } from '../framework/event.js';

/* ---------- runtime element refs ---------- */
const refs = {
  nicknameInput: null,
  chatInput: null
};

/* ---------- helpers ---------- */
function showError(msg) {
  store.setState({ error: msg });
  setTimeout(() => store.setState({ error: '' }), 3000);
}

function joinGame() {
  const nickname = refs.nicknameInput?.value.trim() || '';
  if (!nickname) return store.setState({ error: 'Please enter a nickname.' });

  store.setState({ nickname, error: '' });
  socket.send(JSON.stringify({ type: 'join', payload: { nickname } }));
}

function handleRestart() {
  socket.send(JSON.stringify({ type: 'restart' }));
  store.setState({ screen: 'waiting', error: '' });
}

function sendChat() {
  const message = refs.chatInput?.value.trim() || '';
  if (!message) return showError('Please enter a message.');

  socket.send(JSON.stringify({ type: 'chat', payload: { message } }));
  refs.chatInput.value = '';
}

/* ---------- key handlers ---------- */
const onNicknameKeyup = e => e.key === 'Enter' && joinGame();
const onChatKeyup = e => e.key === 'Enter' && sendChat();

/* ---------- root view ---------- */
export function AppView(state) {
  return createVNode('div', { class: 'app' }, [
    state.screen === 'nickname' && NicknameScreen(state),
    state.screen === 'waiting' && WaitingScreen(state),
    state.screen === 'game' && GameScreen(state)
  ]);
}

/* ---------- screens ---------- */
function NicknameScreen(state) {
  return createVNode('div', {
    class: 'screen',
    style: `display:${state.screen === 'nickname' ? 'block' : 'none'}`
  }, [
    createVNode('h1', {}, '🎮 BOMBERMAN DOM'),
    createVNode('input', {
      class: 'nickname-input',
      type: 'text',
      placeholder: 'Enter your nickname',
      maxlength: 15,
      value: state.nickname,
      ref: el => (refs.nicknameInput = el),
      onkeyup: onNicknameKeyup
    }),
    createVNode('button', { class: 'btn', onclick: joinGame }, 'Join Game')
  ]);
}

function WaitingScreen(state) {
  return createVNode('div', {
    class: 'screen',
    style: `display:${state.screen === 'waiting' ? 'block' : 'none'}`
  }, [
    createVNode('h2', {}, 'Waiting for Players…'),
    createVNode('div', { class: 'player-counter' },
      `Players: ${state.playerCount}/4`
    ),
    createVNode('div', { class: 'countdown' },
      state.waitingTime > 0
        ? `Waiting for more players... ${state.waitingTime}s`
        : `Starting Game... ${state.countdown}s`
    ),
    createVNode('button', { class: 'btn', onclick: handleRestart }, 'Restart'),
    /* chat */
    createVNode('div', { class: 'chat-overlay' }, [
      createVNode('div', { class: 'chat-messages' },
        state.chatMessages.map(m =>
          createVNode('div', {}, `${m.nickname}: ${m.message}`)
        )
      ),
      createVNode('div', { class: 'chat-input-container' }, [
        createVNode('input', {
          class: 'chat-input',
          type: 'text',
          placeholder: 'Type message…',
          ref: el => (refs.chatInput = el),
          onkeyup: onChatKeyup
        }),
        createVNode('button', { class: 'chat-send', onclick: sendChat }, 'Send')
      ])
    ])
  ]);
}

function GameScreen(state) {
  return createVNode('div', {
    class: 'screen',
    style: `display:${state.screen === 'game' ? 'block' : 'none'}`
  }, [renderGame(state.gameState, state.playerId)]);
}

/* ---------- WebSocket updates ---------- */
socket.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  switch (msg.type) {
    case 'playerId':
      store.setState({ playerId: msg.payload }); break;
    case 'playerList':
      store.setState({
        players: msg.payload,
        playerCount: msg.payload.length, error: ''
      });
      break;
    case 'waiting':
      store.setState({
        screen: 'waiting',
        waitingTime: msg.payload.waiting,
        chatVisible: true, error: ''
      });
      break;
    case 'countdown':
      store.setState({
        screen: 'waiting',
        countdown: msg.payload.countdown, error: ''
      });
      break;
    case 'gameStart':
      store.setState({
        screen: 'game', gameStarted: true,
        chatVisible: true, error: ''
      });
      break;
    case 'state':
      store.setState({ gameState: msg.payload }); break;
    case 'chat':
      store.setState({
        chatMessages:
          [...store.getState().chatMessages, msg.payload], error: ''
      });
      break;
    case 'winner':
      store.setState({
        winner: msg.payload,
        screen: '', gameStarted: false, error: ''
      });
      break;
    case 'error':
      store.setState({ error: msg.payload.message }); break;
  }
};
