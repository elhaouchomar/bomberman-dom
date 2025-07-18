import { render } from '../framework/core.js';
import store from '../framework/state.js';
import { AppView, attachViewGlobalEvents } from './view.js';
import { sendAction } from './websocket.js';

attachViewGlobalEvents();

// Keyboard controls
document.onkeydown = function (e) {
  let payload = null;
  switch (e.key) {
    case 'ArrowUp':    payload = { type: 'move', dx: 0,  dy: -1 }; break;
    case 'ArrowDown':  payload = { type: 'move', dx: 0,  dy:  1 }; break;
    case 'ArrowLeft':  payload = { type: 'move', dx: -1, dy:  0 }; break;
    case 'ArrowRight': payload = { type: 'move', dx:  1, dy:  0 }; break;
    case ' ':          payload = { type: 'placeBomb' }; break;
    default: break;
  }
  if (payload) {
    sendAction(payload);
    e.preventDefault();
  }
}

// Render on state change
const root = document.body;
function rerender() {
  render(AppView(store.getState()), root);
}
store.subscribe(rerender);
rerender();
