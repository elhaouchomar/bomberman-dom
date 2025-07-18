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
  if (movementKeys[e.key]) {
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
    if (currentMoveKey === e.key) {
      currentMoveKey = null;
      if (moveAnimationFrame) {
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
  // console.log("apppppp", store.getState());
  render(AppView(store.getState()), root);
}
store.subscribe(rerender);
rerender();
