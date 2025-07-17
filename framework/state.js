let state = {
  // UI Screens
  screen: 'nickname', // 'nickname', 'waiting', 'game'

  // User Info
  nickname: '',         // The player's chosen nickname
  playerId: '',         // The unique ID assigned by the server

  // Lobby/Waiting Room
  players: [],          // List of players in the lobby [{id, nickname}, ...]
  playerCount: 0,       // Number of players in the lobby
  waitingTime: 0,       // Time left in the waiting screen
  countdown: 0,         // Countdown before game starts

  // Game State
  gameStarted: false,   // Is the game currently running?
  gameMap: null,        // The current game map (could be a 2D array or object)
  gameState: null,      // The full game state from the server (positions, bombs, etc.)

  // Player In-Game Info
  playerInfo: {
    lives: 3,
    bombs: 1,
    power: 1,
    speed: 1,
    // ...add more as needed
  },

  // Chat
  chatVisible: false,   // Is the chat overlay visible?
  chatMessages: [],     // Array of chat messages [{nickname, message}, ...]

  // Winner
  winner: null,         // {id, nickname} or null

  // Error/Notifications
  error: '',            // Error messages to display to the user

  // Any other UI state
  // e.g., modalVisible: false, etc.
};

/* subscriber list */
let subscribers = [];

export const store = {
  getState() {
    return { ...state };
  },

  setState(partial) {    
    state = { ...state, ...partial };   // simple, generic merge
    
    subscribers?.forEach( fn => { fn()});    // notify after every commit
  },

  /* subscribe returns an "unsubscribe" function */
  subscribe(fn) {
    subscribers.push(fn);
    return () => {
      subscribers = subscribers.filter(sub => sub !== fn);
    };
  },

  /* (optional) completely replace state – handy for tests or reset */
  // reset(newState = {}) {
  //   state = { ...newState };
  //   subscribers.forEach(fn => fn());
  // }
};

export default store;