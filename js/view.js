import { createVNode, refs } from '../framework/core.js';
import store from '../framework/state.js';
import { socket } from './websocket.js';
import { renderGame } from './renderer.js';

// Handle click events
export function attachViewGlobalEvents() {
  document.body.onclick = function (e) {
    if (e.target === refs.joinBtn) {
      const nickname = refs.nicknameInput?.value.trim() || '';
      if (!nickname) {
        store.setState({ error: 'Please enter a nickname.' });
        return;
      }

      store.setState({ nickname, error: '' });
      socket.send(JSON.stringify({ type: 'join', payload: { nickname } }));
    }

    if (e.target === refs.chatSend) {
      const message = refs.chatInput?.value.trim();
      if (!message) return;
      socket.send(JSON.stringify({ type: 'chat', payload: { message } }));
      refs.chatInput.value = '';
    }

    if (e.target.id === 'restart-btn') {
      socket.send(JSON.stringify({ type: 'restart' }));

    }
  };

  // Handle Enter key
  document.body.onkeydown = function (e) {
    if (e.target === refs.nicknameInput && e.key === 'Enter') {
      refs.joinBtn?.click();
    }

    if (e.target === refs.chatInput && e.key === 'Enter') {
      refs.chatSend?.click();
    }
  };
}

export function AppView(state) {
  return createVNode('div', { class: 'app' }, [
    state.screen === 'nickname' && NicknameScreen(state),
    state.screen === 'waiting' && WaitingScreen(state),
    state.screen === 'waiting' && ChatOverlay(state),
    state.screen === 'game' && GameScreen(state),
    state.screen === 'winner' && WinnerBanner(state)
  ]);
}

function NicknameScreen(state) {
  return createVNode('div', { class: 'bomber', id: 'nickname-screen' }, [
    createVNode('h1', {}, '🎮 BOMBERMAN DOM'),
    createVNode('input', {
      id: 'nickname-input',
      ref: el => refs.nicknameInput = el,
      class: 'nickname-input',
      type: 'text',
      placeholder: 'Enter your nickname',
      maxlength: 15,
      value: state.nickname || ''
    }),
    createVNode('button', {
      id: 'join-btn',
      ref: el => { console.log('eeeeeeeeeeel', refs), refs.joinBtn = el, console.log('refs.joinBtn', refs.joinBtn); },
      class: 'btn'
    }, 'Join Game'),
    ErrorBanner(state)
  ]);
}

function WaitingScreen(state) {
  return createVNode('div', {
    class: 'waiting',
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
    ErrorBanner(state)
  ]);
}

function GameScreen(state) {
  return createVNode('div', {
    class: 'screen',
    id: 'game-screen',
    style: `display:${state.screen === 'game' ? 'block' : 'none'}`
  }, [renderGame(state.gameState, state.playerId)]);
}

function ChatOverlay(state) {
  return createVNode('div', { class: 'chat-overlay' }, [

    /* messages */
    createVNode('div', { id: 'chat-messages', class: 'chat-messages' },
      state.chatMessages.map(msg =>
        createVNode('div', { class: 'chat-msg' }, `${msg.nickname}: ${msg.message}`)
      )
    ),

    /* input + icon (single relative container) */
    createVNode('div', { class: 'chat-row' }, [

      /* text box */
      createVNode('input', {
        id: 'chat-input',
        ref: el => (refs.chatInput = el),
        class: 'chat-input',
        type: 'text',
        placeholder: 'Type message…'
      }),

      /* invisible button that sits ON the input */
      createVNode('button', {
        id: 'chat-send',
        ref: el => (refs.chatSend = el),
        class: 'chat-send',
        title: 'Send'
      }, '➤'),
    ])
  ]);
}



function ErrorBanner(state) {
  return state.error
    ? createVNode('div', { class: 'error-banner' }, state.error)
    : null;
}

function WinnerBanner(data) {
  const message = data.type === 'win' ?
    ` 🎉 Congratulations, ${data.winner.nickname}! You are the winner of the game! 🏆` :
    data.type === 'lose' ? `💀 Sorry, ${data.winner.nickname}! you have lost the game. Better luck next game! 💪` :
      `☠️ All players have died. Game Over.`;
  return createVNode('div', { class: 'winner-overlay' }, [
    createVNode('div', { class: 'winner-banner' }, message),
    createVNode('button', {
      id: 'restart-btn',
      class: 'btn restart-btn'
    }, 'Restart Game')
  ]);
}
