import { render } from '../framework/core.js';
import store from '../framework/state.js';
import { AppView, attachViewGlobalEvents } from './view.js';
import { sendAction } from './websocket.js';

attachViewGlobalEvents();

// Keyboard controls
document.addEventListener('keydown', (e) => {
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
});

// Render on state change
const root = document.body;
function rerender() {
  render(AppView(store.getState()), root);
}
store.subscribe(rerender);
rerender(); // Initial render


// 3. WebSocket message handler (already provided in previous answers)
socket.onmessage = function(event) {
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
        screen: 'waiting',
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


 
