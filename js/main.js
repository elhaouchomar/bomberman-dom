import { render } from '../framework/core.js';
import store from '../framework/state.js';
import { AppView, attachViewGlobalEvents } from './view.js';
import { sendAction } from './websocket.js';

attachViewGlobalEvents();

// Keyboard controls
// Smooth movement with requestAnimationFrame
const movementKeys = {
  ArrowUp:    { dx: 0,  dy: -1 },
  ArrowDown:  { dx: 0,  dy:  1 },
  ArrowLeft:  { dx: -1, dy:  0 },
  ArrowRight: { dx:  1, dy:  0 }
};
let pressedKeys = [];
let currentMoveKey = null;
let moveAnimationFrame = null;

function sendMove() {
  if (currentMoveKey && movementKeys[currentMoveKey]) {
    const { dx, dy } = movementKeys[currentMoveKey];
    sendAction({ type: 'move', dx, dy });
  }
  moveAnimationFrame = requestAnimationFrame(sendMove);
}

document.onkeydown = function (e) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (movementKeys[e.key]) {
    // If not already pressed, add to pressedKeys
    if (!pressedKeys.includes(e.key)) {
      pressedKeys.push(e.key);
    }
    // Always use the most recently pressed key
    if (currentMoveKey !== e.key) {
      currentMoveKey = e.key;
      if (!moveAnimationFrame) {
        sendMove();
      }
    }
    e.preventDefault();
  } else if (e.key === ' ') {
    sendAction({ type: 'placeBomb' });
    e.preventDefault();
  }
};

document.onkeyup = function (e) {
  if (movementKeys[e.key]) {
    // Remove the key from pressedKeys
    pressedKeys = pressedKeys.filter(k => k !== e.key);
    // If the released key was the current direction, switch to the next most recent
    if (currentMoveKey === e.key) {
      currentMoveKey = pressedKeys.length > 0 ? pressedKeys[pressedKeys.length - 1] : null;
      if (!currentMoveKey && moveAnimationFrame) {
        cancelAnimationFrame(moveAnimationFrame);
        moveAnimationFrame = null;
      }
    }
    e.preventDefault();
  }
};

// Render on state change
const root = document.body;
function rerender() {
  render(AppView(store.getState()), root);
}
store.subscribe(rerender);
rerender();
