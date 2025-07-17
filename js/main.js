import { render } from '../framework/core.js';
import store from '../framework/state.js';
import { AppView } from './view.js';
import { socket } from './websocket.js';

document.addEventListener('keydown', (e) => {
  let payload = null;
  switch (e.key) {
    case 'ArrowUp':
      payload = { type: 'move', dx: 0, dy: -1 };
      break;
    case 'ArrowDown':
      payload = { type: 'move', dx: 0, dy: 1 };
      break;
    case 'ArrowLeft':
    // case 'a':
    // case 'A':
      payload = { type: 'move', dx: -1, dy: 0 };
      break;
    case 'ArrowRight':
    // case 'd':
    // case 'D':
      payload = { type: 'move', dx: 1, dy: 0 };
      break;
    case ' ':
      payload = { type: 'placeBomb' };
      break;
    default:
      break;
  }
  if (payload) {
    socket.send(JSON.stringify({
      type: 'action',
      payload
    }));
    e.preventDefault(); // Prevent scrolling
  }
});

// 1. Get the root element
const root = document.body;

// 2. Render the app whenever state changes
function rerender() {
  render(AppView(store.getState()), root);
}
store.subscribe(rerender);
rerender(); // Initial render
console.log(socket);


// 3. WebSocket message handler (already provided in previous answers)
socket.onmessage = function(event) {
  const msg = JSON.parse(event.data);
  console.log(msg);
  
  switch (msg.type) {
    case 'playerId':
      store.setState({ playerId: msg.payload });
      console.log("playerId", store.getState());
      
      break;
    case 'playerList':
      store.setState({
        players: msg.payload,
        playerCount: msg.payload.length,
        error: ''
      });
      console.log("playerList", store.getState());
      break;
    case 'waiting':
      store.setState({
        screen: 'waiting',
        waitingTime: msg.payload.waiting,
        chatVisible: true,
        error: ''
      });
      console.log("waiting", store.getState());
      break;
    case 'countdown':
      store.setState({
        screen: 'waiting',
        countdown: msg.payload.countdown,
        error: ''
      });
      console.log("countdown", store.getState());
      break;
    case 'gameStart':
      store.setState({
        screen: 'game',
        gameStarted: true,
        chatVisible: false,
        error: ''
      });
      console.log("gameStart", store.getState());
      break;
    case 'state':
      store.setState({
        gameState: msg.payload,
      });
      console.log("state", store.getState());
      break;
    case 'chat':
      store.setState({
        chatMessages: [...store.getState().chatMessages, msg.payload],
        error: ''
      });
      console.log("chat", store.getState());
      break;
    case 'winner':
        
      store.setState({
        winner: msg.payload,
        screen: 'waiting',
        gameStarted: false,
        error: ''
      });
      console.log("winner", store.getState());
      break;
    case 'error':
      store.setState({ error: msg.payload.message });
      console.log("error", store.getState());
      break;
    default:
        
      break;
    
  }
};


 