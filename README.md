# 🎮 Bomberman DOM - Multiplayer Game

A real-time multiplayer Bomberman game built with Node.js, WebSockets, and vanilla JavaScript. Features server-authoritative architecture for secure multiplayer gameplay.

## 🏗️ Architecture

This project uses a **server-authoritative** architecture where:
- **Server**: Handles all game logic, state management, and player actions
- **Client**: Only sends user inputs and renders the received game state
- **WebSocket**: Real-time communication between server and clients

## 📁 Project Structure

```
bomberman-dom/
├── index.html              # Main HTML file with UI screens
├── css/
│   └── style.css          # Game styles and animations
├── js/
│   ├── main.js            # Client UI logic and event handling
│   ├── websocket.js       # WebSocket client communication
│   ├── renderer.js        # Game state rendering to DOM
│   └── framework.js       # Utility framework for DOM manipulation
├── server/
│   ├── wsServer.js        # WebSocket server and game loop
│   └── game/
│       └── GameState.js   # Server-side game logic and state
└── package.json           # Dependencies and project config
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd bomberman-dom

# Install dependencies
npm install

# Start the server
node server/wsServer.js
```

### Running the Game
1. **Start the server**: `node server/wsServer.js`
2. **Open your browser** and navigate to `index.html`
3. **Enter a nickname** and click "Join Game"
4. **Wait for other players** (2-4 players required)
5. **Play!** Use arrow keys/WASD to move, spacebar to place bombs

## 🎯 Game Features

### Lobby System
- **Player Limit**: Maximum 4 players per game
- **Auto-start Logic**:
  - 2+ players + 20 seconds → 10-second countdown starts
  - 4 players → 10-second countdown starts immediately
- **Real-time Updates**: Player counter and countdown timers

### Gameplay
- **Movement**: Arrow keys or WASD
- **Bomb Placement**: Spacebar
- **Explosions**: Chain reactions, block destruction, player damage
- **Power-ups**: Collect power-ups that appear when blocks are destroyed:
  - **Bombs**: Increases maximum bombs you can place at once
  - **Flames**: Increases explosion range in all directions
  - **Speed**: Increases movement speed
- **Multiplayer**: Real-time synchronized gameplay
- **Chat**: In-game chat system

### Security
- **Server-authoritative**: All game logic runs on server
- **Action Validation**: Server validates all player actions
- **Anti-cheat**: Clients cannot modify game state

## 🔧 Code Walkthrough

### 1. Server-Side Architecture

#### `server/game/GameState.js`
The core game logic class that manages:
```javascript
class GameState {
    constructor() {
        this.players = new Map();      // Active players
        this.bombs = new Map();        // Active bombs
        this.explosions = new Map();   // Active explosions
        this.walls = new Set();        // Indestructible walls
        this.blocks = new Set();       // Destructible blocks
    }
    
    // Key methods:
    addPlayer(id, nickname, pos)       // Add new player
    applyAction(playerId, action)      // Handle player actions
    tick(dt)                          // Update game state
    generateMap(seed)                 // Create game map
}
```

#### `server/wsServer.js`
WebSocket server that:
- Manages player connections and lobby
- Handles incoming messages (actions, chat, join)
- Broadcasts game state to all clients
- Implements lobby timing logic

### 2. Client-Side Architecture

#### `js/main.js`
Main client logic that:
- Handles UI interactions (nickname input, chat)
- Manages screen transitions (lobby → game)
- Sends user actions to server
- Coordinates with other client modules

#### `js/websocket.js`
WebSocket client that:
- Connects to server
- Sends actions and chat messages
- Receives and routes server messages
- Handles connection errors

#### `js/renderer.js`
Renders game state to DOM:
```javascript
export function renderGame(state, playerId, framework) {
    // Clear previous state
    map.innerHTML = '';
    
    // Render walls, blocks, bombs, explosions, players
    // Update player stats UI
}
```

#### `js/framework.js`
Utility framework for:
- Element creation: `framework.createElement(tag, className, parent)`
- Event handling: `framework.on(element, event, handler)`
- Style management: `framework.setStyle(element, styles)`

### 3. Game Flow

#### Lobby Phase
1. **Player joins** → Server adds to lobby
2. **Player counter updates** → Broadcast to all clients
3. **Timer logic**:
   - 2+ players → Start 20-second waiting timer
   - 4 players → Start 10-second countdown immediately
   - After 20s → Start 10-second countdown

#### Game Phase
1. **Game starts** → All lobby players added to game state
2. **Game loop** → Server ticks every 50ms
3. **Action processing** → Server validates and applies actions
4. **State broadcast** → Server sends updated state to all clients
5. **Client rendering** → Clients render received state

#### Action Flow
```
Client Input → WebSocket → Server → GameState.applyAction() → Broadcast → Client Render
```

### 4. Message Protocol

#### Client → Server
```javascript
// Join game
{ type: 'join', payload: { nickname: 'Player1' } }

// Player action
{ type: 'action', payload: { type: 'move', dx: 1, dy: 0 } }
{ type: 'action', payload: { type: 'placeBomb' } }

// Chat message
{ type: 'chat', payload: { message: 'Hello!' } }
```

#### Server → Client
```javascript
// Game state
{ type: 'state', payload: { players: [...], bombs: [...], ... } }

// Lobby updates
{ type: 'playerList', payload: [{ id: 'p_123', nickname: 'Player1' }] }
{ type: 'waiting', payload: { waiting: 15 } }
{ type: 'countdown', payload: { countdown: 5 } }

// Chat
{ type: 'chat', payload: { nickname: 'Player1', message: 'Hello!' } }
```

## 🎮 Controls

- **Movement**: Arrow keys or WASD
- **Place Bomb**: Spacebar
- **Chat**: Type in chat input and press Enter
- **Join Game**: Enter nickname and click "Join Game"

## 🔒 Security Features

- **Server Authority**: All game logic runs on server
- **Input Validation**: Server validates all player actions
- **State Synchronization**: Clients only receive, never modify game state
- **Connection Management**: Proper player join/leave handling

## 🚀 Deployment

### Local Development
```bash
npm install
node server/wsServer.js
```

### Production
1. Set up a Node.js server
2. Install dependencies: `npm install --production`
3. Start server: `node server/wsServer.js`
4. Serve static files (HTML, CSS, JS) via web server

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🎯 Future Enhancements

- Power-ups (speed, bomb count, explosion range)
- Multiple game rooms
- Player statistics and leaderboards
- Sound effects and music
- Mobile touch controls
- Spectator mode 