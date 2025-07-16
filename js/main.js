import { render } from '../framework/core.js';
import store from '../framework/state.js';
import { AppView } from './view.js';
import { socket } from './websocket.js';

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
        chatVisible: true,
        error: ''
      });
      console.log("gameStart", store.getState());
      break;
    case 'state':
      store.setState({
        gameState: msg.payload,
        // Optionally update playerInfo if included in payload
        // playerInfo: msg.payload.playerInfo
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

// 4. Event handlers (join, chat, restart, etc.) can be in view.js or here, but should always update state/send messages, never manipulate DOM directly. 
 