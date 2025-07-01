# 🔍 Bomberman DOM - Code Walkthrough

This document provides a detailed, step-by-step explanation of how the Bomberman multiplayer game works, from server startup to game rendering.

## 📋 Table of Contents

1. [Server Startup](#server-startup)
2. [Client Connection](#client-connection)
3. [Lobby System](#lobby-system)
4. [Game Initialization](#game-initialization)
5. [Game Loop](#game-loop)
6. [Action Processing](#action-processing)
7. [State Broadcasting](#state-broadcasting)
8. [Client Rendering](#client-rendering)

---

## 🚀 Server Startup

### 1. Server Initialization (`server/wsServer.js`)

```javascript
import WebSocket from 'ws';
import GameState from './game/GameState.js';

const wss = new WebSocket.Server({ port: 8081 });
const gameState = new GameState();
```

**What happens:**
1. **WebSocket Server**: Creates a WebSocket server on port 8081
2. **Game State**: Initializes the main game state object
3. **Map Generation**: Calls `gameState.generateMap()` to create the game map

### 2. Map Generation (`server/game/GameState.js`)

```javascript
generateMap(seed) {
    // Create walls (indestructible)
    for (let x = 1; x < this.mapWidth / this.tileSize; x += 2)
        for (let y = 1; y < this.mapHeight / this.tileSize; y += 2)
            this.walls.add(`${x},${y}`);
    
    // Create blocks (destructible)
    for (let x = 0; x < this.mapWidth / this.tileSize; x++)
        for (let y = 0; y < this.mapHeight / this.tileSize; y++) {
            // Skip walls and safe zones
            if (this.walls.has(key) || isSafeZone) continue;
            if (rng() < 0.3) this.blocks.add(key);
        }
}
```

**What happens:**
1. **Walls**: Places indestructible walls in a grid pattern
2. **Safe Zones**: Leaves corners empty for player spawning
3. **Blocks**: Randomly places destructible blocks (30% chance)
4. **RNG**: Uses seeded random number generator for consistent maps

---

## 🔌 Client Connection

### 3. Client Joins (`js/main.js`)

```javascript
function tryJoin() {
    const n = nicknameInput.value.trim();
    if (!n) return alert('Please enter a nickname');
    
    nickname = n;
    showScreen('waiting-screen');
    
    connectWebSocket({
        nickname,
        onState: (state) => { /* handle game state */ },
        onPlayerId: (id) => { playerId = id; },
        // ... other callbacks
    });
}
```

**What happens:**
1. **Validation**: Checks if nickname is provided
2. **UI Update**: Shows waiting screen
3. **WebSocket Connection**: Establishes connection to server

### 4. Server Accepts Connection (`server/wsServer.js`)

```javascript
wss.on('connection', ws => {
    let playerId = null;
    let nickname = null;
    let joined = false;
    
    ws.on('message', msg => {
        const { type, payload } = JSON.parse(msg);
        
        if (!joined && type === 'join') {
            // Check if lobby is full
            if (lobbyState.players.length >= 4) {
                ws.send(JSON.stringify({ type: 'error', payload: { message: 'Lobby is full' } }));
                ws.close();
                return;
            }
            
            // Add player to lobby
            playerId = 'p_' + Math.random().toString(36).slice(2, 8);
            nickname = payload.nickname.slice(0, 15);
            lobbyState.players.push({ id: playerId, nickname });
            
            // Send confirmation and update lobby
            ws.send(JSON.stringify({ type: 'playerId', payload: playerId }));
            sendPlayerList();
            broadcast({ type: 'chat', payload: { nickname: 'System', message: `${nickname} joined` } });
        }
    });
});
```

**What happens:**
1. **Connection**: Server accepts new WebSocket connection
2. **Lobby Check**: Verifies lobby isn't full (max 4 players)
3. **Player Creation**: Generates unique player ID and adds to lobby
4. **Confirmation**: Sends player ID back to client
5. **Broadcast**: Notifies all clients about new player

---

## 🏠 Lobby System

### 5. Lobby Timer Logic (`server/wsServer.js`)

```javascript
// After player joins
if (lobbyState.players.length >= 4) {
    // 4 players reached, start countdown immediately
    clearTimeout(lobbyState.waitingTimer);
    lobbyState.waitingTimer = null;
    startCountdown();
} else if (lobbyState.players.length >= 2) {
    // 2+ players but less than 4, start waiting timer
    startWaitingTimer();
}

function startWaitingTimer() {
    let waitingTime = 20;
    broadcast({ type: 'waiting', payload: { waiting: waitingTime } });
    
    lobbyState.waitingTimer = setInterval(() => {
        waitingTime--;
        broadcast({ type: 'waiting', payload: { waiting: waitingTime } });
        
        if (waitingTime <= 0) {
            clearInterval(lobbyState.waitingTimer);
            lobbyState.waitingTimer = null;
            startCountdown();
        }
    }, 1000);
}

function startCountdown() {
    lobbyState.countdown = 10;
    broadcast({ type: 'countdown', payload: { countdown: lobbyState.countdown } });
    
    lobbyState.countdownTimer = setInterval(() => {
        lobbyState.countdown--;
        broadcast({ type: 'countdown', payload: { countdown: lobbyState.countdown } });
        
        if (lobbyState.countdown <= 0) {
            startGame();
        }
    }, 1000);
}
```

**What happens:**
1. **2+ Players**: Starts 20-second waiting timer
2. **4 Players**: Immediately starts 10-second countdown
3. **Timer Updates**: Broadcasts countdown to all clients every second
4. **Game Start**: When countdown reaches 0, calls `startGame()`

### 6. Client Lobby Updates (`js/main.js`)

```javascript
function updateWaiting(data) {
    const countdown = document.getElementById('countdown');
    if (countdown) {
        countdown.textContent = `Waiting for more players... ${data.waiting}s`;
    }
}

function updateCountdown(data) {
    const countdown = document.getElementById('countdown');
    if (countdown) {
        countdown.textContent = `Game starts in: ${data.countdown}`;
    }
}

function updatePlayerList(players) {
    const counter = document.getElementById('player-counter');
    if (counter) {
        counter.textContent = `Players: ${players.length}/4`;
    }
}
```

**What happens:**
1. **Waiting Display**: Shows "Waiting for more players... Xs"
2. **Countdown Display**: Shows "Game starts in: X"
3. **Player Counter**: Updates "Players: X/4"

---

## 🎮 Game Initialization

### 7. Game Start (`server/wsServer.js`)

```javascript
function startGame() {
    if (lobbyState.gameStarted) return;
    
    lobbyState.gameStarted = true;
    clearInterval(lobbyState.countdownTimer);
    lobbyState.countdownTimer = null;
    
    // Add all lobby players to the game
    lobbyState.players.forEach((player, index) => {
        const pos = spawnPositions[index % spawnPositions.length];
        gameState.addPlayer(player.id, player.nickname, pos);
    });
    
    broadcast({ type: 'gameStart', payload: {} });
}
```

**What happens:**
1. **Game Flag**: Sets `gameStarted = true`
2. **Player Spawning**: Adds all lobby players to game state with spawn positions
3. **Game Start Message**: Broadcasts game start to all clients

### 8. Client Game Start (`js/main.js`)

```javascript
function startGame() {
    console.log('Game starting!');
    showScreen('game-screen');
    const countdown = document.getElementById('countdown');
    if (countdown) {
        countdown.textContent = '';
    }
}
```

**What happens:**
1. **Screen Transition**: Shows game screen
2. **UI Cleanup**: Clears countdown display

---

## 🔄 Game Loop

### 9. Server Game Loop (`server/wsServer.js`)

```javascript
const TICK_RATE = 50; // ms
setInterval(() => {
    if (lobbyState.gameStarted) {
        gameState.tick(TICK_RATE);
        const stateMsg = JSON.stringify({ type: 'state', payload: gameState.toJSON() });
        wss.clients.forEach(c => {
            if (c.readyState === WebSocket.OPEN) {
                c.send(stateMsg);
            }
        });
    }
}, TICK_RATE);
```

**What happens:**
1. **50ms Interval**: Runs every 50ms (20 FPS)
2. **Game Tick**: Calls `gameState.tick(dt)` to update game state
3. **State Serialization**: Converts game state to JSON
4. **Broadcast**: Sends state to all connected clients

### 10. Game State Tick (`server/game/GameState.js`)

```javascript
tick(dt) {
    // Update bombs
    for (const [id, bomb] of Array.from(this.bombs.entries())) {
        bomb.timer -= dt;
        if (bomb.timer <= 0) {
            this.explodeBomb(bomb, id);
        }
    }
    
    // Update explosions
    for (const [id, explosion] of Array.from(this.explosions.entries())) {
        explosion.timer -= dt;
        if (explosion.timer <= 0) {
            this.explosions.delete(id);
        }
    }
}
```

**What happens:**
1. **Bomb Timers**: Decrements all bomb timers
2. **Explosions**: Triggers explosions when timers reach 0
3. **Explosion Cleanup**: Removes expired explosions

---

## 🎯 Action Processing

### 11. Client Input (`js/main.js`)

```javascript
const keyMap = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
    w: { dx: 0, dy: -1 },
    s: { dx: 0, dy: 1 },
    a: { dx: -1, dy: 0 },
    d: { dx: 1, dy: 0 }
};

framework.on(document, 'keydown', (e) => {
    if (document.activeElement === chatInput) return;
    
    if (keyMap[e.key]) {
        window.sendAction({ type: 'move', ...keyMap[e.key] });
    }
    if (e.key === ' ') {
        window.sendAction({ type: 'placeBomb' });
    }
});
```

**What happens:**
1. **Key Detection**: Detects arrow keys or WASD
2. **Action Creation**: Creates move action with direction
3. **WebSocket Send**: Sends action to server via `window.sendAction()`

### 12. Server Action Processing (`server/game/GameState.js`)

```javascript
applyAction(playerId, action) {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return;
    
    switch (action.type) {
        case 'move': {
            const { dx, dy } = action;
            const speed = player.speed * 2;
            const nx = player.x + (dx * speed);
            const ny = player.y + (dy * speed);
            
            if (this.isValidPosition(nx, ny)) {
                player.x = nx;
                player.y = ny;
            }
            // Check for powerup collection
            this.checkPowerupCollection(player);
            break;
        }
        case 'placeBomb': {
            if (player.activeBombs >= player.maxBombs) return;
            
            const bx = Math.floor((player.x + 16) / this.tileSize) * this.tileSize;
            const by = Math.floor((player.y + 16) / this.tileSize) * this.tileSize;
            const id = `${bx},${by}`;
            
            if (this.bombs.has(id)) return;
            
            this.bombs.set(id, {
                x: bx, y: by, timer: 3000, power: player.power, owner: player.id
            });
            player.activeBombs++;
            break;
        }
    }
}
```

**What happens:**
1. **Player Validation**: Checks if player exists and is alive
2. **Move Action**: Validates new position and updates player coordinates
3. **Power-up Collection**: Checks if player is touching any power-ups
4. **Bomb Action**: Checks bomb limits and places bomb at player's tile
5. **Collision Detection**: Uses `isValidPosition()` to prevent wall/block collisions

### 13. Power-ups System (`server/game/GameState.js`)

```javascript
maybeSpawnPowerup(x, y) {
    // 30% chance to spawn a powerup when a block is destroyed
    if (Math.random() < 0.3) {
        const powerupTypes = ['bombs', 'flames', 'speed'];
        const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        const powerupId = `${x},${y}`;
        
        this.powerups.set(powerupId, {
            x: x, y: y, type: randomType
        });
    }
}

checkPowerupCollection(player) {
    const playerCenterX = player.x + 16;
    const playerCenterY = player.y + 16;
    
    for (const [id, powerup] of Array.from(this.powerups.entries())) {
        const powerupCenterX = powerup.x + 20;
        const powerupCenterY = powerup.y + 20;
        
        // Check if player is touching the powerup
        if (Math.abs(playerCenterX - powerupCenterX) < 20 && 
            Math.abs(playerCenterY - powerupCenterY) < 20) {
            
            // Apply powerup effect
            this.applyPowerup(player, powerup.type);
            
            // Remove powerup from map
            this.powerups.delete(id);
        }
    }
}

applyPowerup(player, type) {
    switch (type) {
        case 'bombs':
            player.maxBombs++;
            break;
        case 'flames':
            player.power++;
            break;
        case 'speed':
            player.speed++;
            break;
    }
}
```

**What happens:**
1. **Block Destruction**: When a block is destroyed by explosion, 30% chance to spawn power-up
2. **Power-up Types**: Randomly selects from bombs, flames, or speed
3. **Collection Detection**: Checks if player is touching power-up during movement
4. **Effect Application**: Increases player stats based on power-up type
5. **Cleanup**: Removes collected power-up from map

---

## 📡 State Broadcasting

### 14. State Serialization (`server/game/GameState.js`)

```javascript
toJSON() {
    return {
        players: Array.from(this.players.values()),
        bombs: Array.from(this.bombs.values()),
        explosions: Array.from(this.explosions.values()),
        walls: Array.from(this.walls),
        blocks: Array.from(this.blocks),
        mapWidth: this.mapWidth,
        mapHeight: this.mapHeight,
        tileSize: this.tileSize
    };
}
```

**What happens:**
1. **Data Conversion**: Converts Maps and Sets to arrays for JSON serialization
2. **State Package**: Creates complete game state object
3. **Network Ready**: Prepares data for WebSocket transmission

### 15. Client State Reception (`js/websocket.js`)

```javascript
ws.onmessage = (event) => {
    try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state') {
            onStateCb && onStateCb(msg.payload);
        }
        // ... handle other message types
    } catch (err) {
        onError && onError('Error parsing server message');
    }
};
```

**What happens:**
1. **Message Reception**: Receives WebSocket message
2. **JSON Parsing**: Parses the message data
3. **Callback Routing**: Routes state updates to appropriate handler

---

## 🎨 Client Rendering

### 16. Game Rendering (`js/renderer.js`)

```javascript
export function renderGame(state, playerId, framework) {
    const map = document.getElementById('game-map');
    if (!map) return;
    map.innerHTML = ''; // Clear previous state
    
    // Draw walls
    state.walls.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const d = framework.createElement('div', 'wall', map);
        framework.setStyle(d, {
            left: `${x * state.tileSize}px`,
            top: `${y * state.tileSize}px`
        });
    });
    
    // Draw blocks
    state.blocks.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const d = framework.createElement('div', 'block', map);
        framework.setStyle(d, {
            left: `${x * state.tileSize}px`,
            top: `${y * state.tileSize}px`
        });
    });
    
    // Draw powerups
    state.powerups.forEach(powerup => {
        const d = framework.createElement('div', `powerup ${powerup.type}`, map);
        framework.setStyle(d, {
            left: `${powerup.x + 5}px`,
            top: `${powerup.y + 5}px`
        });
        d.title = `${powerup.type.charAt(0).toUpperCase() + powerup.type.slice(1)} Power-up`;
    });
    
    // Draw bombs
    state.bombs.forEach(bomb => {
        const d = framework.createElement('div', 'bomb', map);
        framework.setStyle(d, {
            left: `${bomb.x + 4}px`,
            top: `${bomb.y + 4}px`
        });
    });
    
    // Draw explosions
    state.explosions.forEach(explosion => {
        const d = framework.createElement('div', 'explosion', map);
        framework.setStyle(d, {
            left: `${explosion.x}px`,
            top: `${explosion.y}px`
        });
    });
    
    // Draw players
    state.players.forEach(p => {
        if (!p.alive) return;
        const d = framework.createElement('div', `player ${p.id === playerId ? 'me' : ''}`, map);
        framework.setStyle(d, {
            left: `${p.x}px`,
            top: `${p.y}px`,
            background: getPlayerColor(p.id)
        });
        d.title = p.nickname;
    });
    
    // Update UI
    if (playerId) {
        const me = state.players.find(p => p.id === playerId);
        if (me) {
            document.getElementById('lives').textContent = me.lives;
            document.getElementById('bombs').textContent = me.maxBombs;
            document.getElementById('power').textContent = me.power;
            document.getElementById('speed').textContent = me.speed;
        }
    }
}
```

**What happens:**
1. **State Clear**: Clears previous game state from DOM
2. **Element Creation**: Creates DOM elements for each game object
3. **Power-up Rendering**: Creates colored power-up elements with tooltips
4. **Positioning**: Sets absolute positioning for all elements
5. **Styling**: Applies CSS classes and colors
6. **UI Update**: Updates player stats display

---

## 🔄 Complete Flow Summary

```
1. Server Startup
   ├── WebSocket server on port 8081
   ├── GameState initialization
   └── Map generation

2. Client Connection
   ├── User enters nickname
   ├── WebSocket connection established
   └── Player added to lobby

3. Lobby System
   ├── Player counter updates
   ├── 20-second waiting timer (if 2+ players)
   └── 10-second countdown

4. Game Initialization
   ├── All players added to game state
   ├── Spawn positions assigned
   └── Game loop starts

5. Game Loop (50ms intervals)
   ├── Process player actions
   ├── Update bomb timers
   ├── Handle explosions
   └── Broadcast state to all clients

6. Client Rendering
   ├── Receive state from server
   ├── Clear previous state
   ├── Create DOM elements
   └── Update UI
```

This architecture ensures:
- **Security**: All game logic runs on server
- **Synchronization**: All clients see the same game state
- **Performance**: Efficient state updates every 50ms
- **Scalability**: Easy to add features and maintain 