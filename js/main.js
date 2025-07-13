import { connectWebSocket, sendChat } from './websocket.js';
import { renderGame } from './renderer.js';
import { MiniFramework } from './framework.js';

// let gameState = null;
let playerId = null;
let nickname = '';
const framework = new MiniFramework();

// UI elements created by framework
let appContainer = null;
let nicknameScreen = null;
let waitingScreen = null;
let gameScreen = null;
let chatOverlay = null;

// Smooth movement variables
let animationId = null;
let lastServerState = null;
let currentState = null;
let playerActions = [];
let lastRenderTime = 0;
const SERVER_TICK_RATE = 50; // 20 FPS
// const CLIENT_TICK_RATE = 16; // ~60 FPS for smooth rendering

// Initialize the application using the framework
function initializeApp() {
    // Get the main app container
    appContainer = document.getElementById('app');
    if (!appContainer) {
        console.error('App container not found!');
        return;
    }

    // Create all screens using the framework
    createNicknameScreen();
    createWaitingScreen();
    createGameScreen();
    createChatOverlay();

    // Show nickname screen by default
    showScreen('nickname-screen');
}

function createNicknameScreen() {
    nicknameScreen = framework.createElement('div', 'screen active', appContainer);
    nicknameScreen.id = 'nickname-screen';
    
    const nicknameContainer = framework.createElement('div', 'nickname-screen', nicknameScreen);
    
    const title = framework.createElement('h1', '', nicknameContainer);
    title.textContent = '🎮 BOMBERMAN DOM';
    
    const nicknameInput = framework.createElement('input', 'nickname-input', nicknameContainer);
    nicknameInput.id = 'nickname-input';
    nicknameInput.type = 'text';
    nicknameInput.placeholder = 'Enter your nickname';
    nicknameInput.maxLength = 15;
    
    const lineBreak = framework.createElement('br', '', nicknameContainer);
    
    const joinBtn = framework.createElement('button', 'btn', nicknameContainer);
    joinBtn.id = 'join-btn';
    joinBtn.textContent = 'Join Game';
    
    // Add event listeners using framework
    framework.on(joinBtn, 'click', tryJoin);
    framework.on(nicknameInput, 'keydown', e => { if (e.key === 'Enter') tryJoin(); });
}

function createWaitingScreen() {
    waitingScreen = framework.createElement('div', 'screen', appContainer);
    waitingScreen.id = 'waiting-screen';
    
    const waitingContainer = framework.createElement('div', 'waiting-screen', waitingScreen);
    
    const title = framework.createElement('h2', '', waitingContainer);
    title.textContent = 'Waiting for Players…';
    
    const playerCounter = framework.createElement('div', 'player-counter', waitingContainer);
    playerCounter.id = 'player-counter';
    playerCounter.textContent = 'Players: 0/4';
    
    const countdown = framework.createElement('div', 'countdown', waitingContainer);
    countdown.id = 'countdown';
}

function createGameScreen() {
    gameScreen = framework.createElement('div', 'screen', appContainer);
    gameScreen.id = 'game-screen';
    
    const gameContainer = framework.createElement('div', 'game-container', gameScreen);
    
    const gameUI = framework.createElement('div', 'game-ui', gameContainer);
    
    const playerInfo = framework.createElement('div', 'player-info', gameUI);
    playerInfo.id = 'player-info';
    
    // Create player stats containers
    const livesContainer = framework.createElement('div', '', playerInfo);
    const livesSpan = framework.createElement('span', '', livesContainer);
    livesSpan.id = 'lives';
    
    const bombsContainer = framework.createElement('div', '', playerInfo);
    const bombsSpan = framework.createElement('span', '', bombsContainer);
    bombsSpan.id = 'bombs';
    
    const powerContainer = framework.createElement('div', '', playerInfo);
    const powerSpan = framework.createElement('span', '', powerContainer);
    powerSpan.id = 'power';
    
    const speedContainer = framework.createElement('div', '', playerInfo);
    const speedSpan = framework.createElement('span', '', speedContainer);
    speedSpan.id = 'speed';
    
    const gameMap = framework.createElement('div', 'game-map', gameContainer);
    gameMap.id = 'game-map';
}

function createChatOverlay() {
    chatOverlay = framework.createElement('div', 'chat-overlay', appContainer);
    
    const chatMessages = framework.createElement('div', 'chat-messages', chatOverlay);
    chatMessages.id = 'chat-messages';
    
    const chatInputContainer = framework.createElement('div', 'chat-input-container', chatOverlay);
    
    const chatInput = framework.createElement('input', 'chat-input', chatInputContainer);
    chatInput.id = 'chat-input';
    chatInput.type = 'text';
    chatInput.placeholder = 'Type message…';
    
    const chatSend = framework.createElement('button', 'chat-send', chatInputContainer);
    chatSend.id = 'chat-send';
    chatSend.textContent = 'Send';
    
    // Add event listeners using framework
    framework.on(chatSend, 'click', sendChatMsg);
    framework.on(chatInput, 'keydown', e => { if (e.key === 'Enter') sendChatMsg(); });
}

function showScreen(id) {
    console.log('Showing screen:', id);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
}

// Nickname join logic
function tryJoin() {
    console.log('TryJoin called');
    const nicknameInput = document.getElementById('nickname-input');
    const n = nicknameInput.value.trim();
    console.log('Nickname:', n);
    if (!n) return alert('Please enter a nickname');
    nickname = n;
    showScreen('waiting-screen');
    console.log('Connecting to WebSocket...');
    connectWebSocket({
        nickname,
        onState: (state) => {
            console.log('Received state:', state);
            // Store the server state for interpolation
            lastServerState = currentState;
            currentState = JSON.parse(JSON.stringify(state)); // Deep copy
            
            // Clear player actions since server has processed them
            playerActions = [];
            
            // Start smooth rendering if not already running
            if (!animationId && state.players && state.players.length > 0) {
                startSmoothRendering();
            }
        },
        onPlayerId: (id) => {
            console.log('Received player ID:', id);
            playerId = id;
        },
        onChat: addChat,
        onPlayerList: updatePlayerList,
        onCountdown: updateCountdown,
        onGameStart: startGame,
        onWaiting: updateWaiting,
        onError: (err) => {
            console.error('WebSocket error:', err);
            handleConnectionError(err);
        },
        onWinner: showWinnerMessage,
    });
}

function handleConnectionError(err) {
    console.error('Connection error:', err);
    
    // Check if it's a duplicate username error
    if (err.includes('already taken')) {
        // Show error message and return to nickname screen
        showScreen('nickname-screen');
        
        // Clear the nickname input and show error
        const nicknameInput = document.getElementById('nickname-input');
        if (nicknameInput) {
            nicknameInput.value = '';
            nicknameInput.focus();
        }
        
        // Show error message
        showErrorMessage(err);
    } else {
        // For other errors, show alert and return to nickname screen
        alert(err);
        showScreen('nickname-screen');
    }
}

function showErrorMessage(message) {
    // Remove any existing error message
    const existingError = document.getElementById('error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create error message element using framework
    const errorDiv = framework.createElement('div', '', document.getElementById('nickname-screen'));
    errorDiv.id = 'error-message';
    framework.setStyle(errorDiv, {
        color: '#ff4444',
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        border: '1px solid #ff4444',
        borderRadius: '8px',
        padding: '1rem',
        marginTop: '1rem',
        textAlign: 'center',
        fontSize: '0.9rem'
    });
    errorDiv.textContent = message;
    
    // Insert after the join button
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn && joinBtn.parentNode) {
        joinBtn.parentNode.insertBefore(errorDiv, joinBtn.nextSibling);
    }
}

// Smooth rendering function using requestAnimationFrame
function startSmoothRendering() {
    if (animationId) return;
    
    function renderLoop(currentTime) {
        if (!currentState) {
            animationId = requestAnimationFrame(renderLoop);
            return;
        }
        
        // Calculate interpolation factor
        const deltaTime = currentTime - lastRenderTime;
        lastRenderTime = currentTime;
        
        // Create interpolated state
        const interpolatedState = interpolateState(currentState, lastServerState, deltaTime);
        
        // Apply client-side prediction for local player
        if (playerId) {
            applyClientPrediction(interpolatedState, playerId, playerActions);
        }
        
        // Render the interpolated state
        renderGame(interpolatedState, playerId, framework);
        
        animationId = requestAnimationFrame(renderLoop);
    }
    
    lastRenderTime = performance.now();
    animationId = requestAnimationFrame(renderLoop);
}

// Interpolate between server states for smooth movement
function interpolateState(currentState, lastState, deltaTime) {
    if (!lastState || !currentState) return currentState;
    
    const interpolatedState = JSON.parse(JSON.stringify(currentState));
    const interpolationFactor = Math.min(deltaTime / SERVER_TICK_RATE, 1);
    
    // Interpolate player positions
    interpolatedState.players.forEach((player, index) => {
        const lastPlayer = lastState.players.find(p => p.id === player.id);
        if (lastPlayer && player.alive && lastPlayer.alive) {
            // Only interpolate if it's not the local player (we'll use prediction for that)
            if (player.id !== playerId) {
                player.x = lastPlayer.x + (player.x - lastPlayer.x) * interpolationFactor;
                player.y = lastPlayer.y + (player.y - lastPlayer.y) * interpolationFactor;
            }
        }
    });
    
    return interpolatedState;
}

// Apply client-side prediction for local player
function applyClientPrediction(state, localPlayerId, actions) {
    const localPlayer = state.players.find(p => p.id === localPlayerId);
    if (!localPlayer || !localPlayer.alive) return;
    
    // Apply pending actions to predict movement
    actions.forEach(action => {
        if (action.type === 'move') {
            const speed = localPlayer.speed * 2;
            const nx = localPlayer.x + (action.dx * speed);
            const ny = localPlayer.y + (action.dy * speed);
            
            // Simple collision check (you might want to improve this)
            if (isValidPosition(nx, ny, state)) {
                localPlayer.x = nx;
                localPlayer.y = ny;
            }
        }
    });
}

// Simple collision detection for client prediction
function isValidPosition(x, y, state) {
    const tileSize = state.tileSize;
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);
    
    // Check walls
    if (state.walls.includes(`${tileX},${tileY}`)) return false;
    
    // Check blocks
    if (state.blocks.includes(`${tileX},${tileY}`)) return false;
    
    // Check map boundaries
    if (x < 0 || y < 0 || x + 32 > state.mapWidth || y + 32 > state.mapHeight) return false;
    
    return true;
}

function updateWaiting(data) {
    console.log('Waiting:', data.waiting);
    const countdown = document.getElementById('countdown');
    if (countdown) {
        if (data.waiting > 0) {
            countdown.textContent = `Waiting for more players... ${data.waiting}s`;
        } else {
            countdown.textContent = 'Starting countdown...';
        }
    }
}

function updatePlayerList(players) {
    console.log('Player list updated:', players);
    const counter = document.getElementById('player-counter');
    if (counter) {
        counter.textContent = `Players: ${players.length}/4`;
    }
}

function updateCountdown(data) {
    console.log('Countdown:', data.countdown);
    const countdown = document.getElementById('countdown');
    if (countdown) {
        if (data.countdown > 0) {
            countdown.textContent = `Game starts in: ${data.countdown}`;
        } else {
            countdown.textContent = 'Starting game...';
        }
    }
}

function startGame() {
    console.log('Game starting!');
    showScreen('game-screen');
    const countdown = document.getElementById('countdown');
    if (countdown) {
        countdown.textContent = '';
    }
    hideWinnerMessage();
    
    // Hide chat during gameplay
    const chatOverlay = document.querySelector('.chat-overlay');
    if (chatOverlay) {
        chatOverlay.style.display = 'none';
    }
}

// Add handler for winner message from websocket.js
function showWinnerMessage({ id, nickname }) {
    console.log("winner before selected");
    
    // Show chat again when game ends
    const chatOverlay = document.querySelector('.chat-overlay');
    if (chatOverlay) {
        chatOverlay.style.display = 'flex';
    }
    
    let winnerOverlay = document.getElementById('winner-overlay');
    if (!winnerOverlay) {
        winnerOverlay = document.createElement('div');
        winnerOverlay.id = 'winner-overlay';
        winnerOverlay.style.position = 'fixed';
        winnerOverlay.style.top = '0';
        winnerOverlay.style.left = '0';
        winnerOverlay.style.width = '100vw';
        winnerOverlay.style.height = '100vh';
        winnerOverlay.style.background = 'rgba(0,0,0,0.7)';
        winnerOverlay.style.display = 'flex';
        winnerOverlay.style.alignItems = 'center';
        winnerOverlay.style.justifyContent = 'center';
        winnerOverlay.style.zIndex = '1000';
        winnerOverlay.style.fontSize = '3rem';
        winnerOverlay.style.color = '#fff';
        document.body.appendChild(winnerOverlay);
    }
    console.log("winner after selected");
    
    // Handle tie scenario
    if (id === null) {
        winnerOverlay.textContent = nickname; // "TIE - All players died!"
    } else {
        winnerOverlay.textContent = `Winner: ${nickname}!`;
    }
    winnerOverlay.style.display = 'flex';
}

// Hide winner overlay when game restarts
function hideWinnerMessage() {
    const winnerOverlay = document.getElementById('winner-overlay');
    if (winnerOverlay) winnerOverlay.style.display = 'none';
}

// Cleanup function to stop smooth rendering
function stopSmoothRendering() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    currentState = null;
    lastServerState = null;
    playerActions = [];
}

// Chat logic
function sendChatMsg() {
    const chatInput = document.getElementById('chat-input');
    const msg = chatInput.value.trim();
    if (!msg) return;
    sendChat(msg);
    chatInput.value = '';
}

// Keep track of last message to prevent duplicates
let lastMessage = null;

function addChat({ nickname, message }) {
    // Check for duplicate messages
    const currentMessage = `${nickname}:${message}`;
    if (lastMessage === currentMessage) {
        return; // Skip duplicate
    }
    lastMessage = currentMessage;
    
    const box = document.getElementById('chat-messages');
    const d = framework.createElement('div', '', box);
    d.innerHTML = `<strong>${nickname}:</strong> ${message}`;
    box.scrollTop = box.scrollHeight;
}

// Handle user input and send actions with improved smooth movement
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

// Track pressed keys for continuous movement
const pressedKeys = new Set();

framework.on(document, 'keydown', (e) => {
    if (document.activeElement === chatInput) return;
    
    if (keyMap[e.key]) {
        pressedKeys.add(e.key);
        // Add action to player actions for immediate client prediction
        const action = { type: 'move', ...keyMap[e.key] };
        playerActions.push(action);
        window.sendAction(action);
    }
    if (e.key === ' ') {
        window.sendAction({ type: 'placeBomb' });
    }
});

framework.on(document, 'keyup', (e) => {
    if (keyMap[e.key]) {
        pressedKeys.delete(e.key);
    }
});



// Handle continuous movement for held keys
function handleContinuousMovement() {
    if (!currentState || !playerId) return;
    
    const localPlayer = currentState.players.find(p => p.id === playerId);
    if (!localPlayer || !localPlayer.alive) return;
    
    // Check for held keys and send movement actions
    pressedKeys.forEach(key => {
        if (keyMap[key]) {
            const action = { type: 'move', ...keyMap[key] };
            window.sendAction(action);
        }
    });
}

// Set up continuous movement timer
setInterval(handleContinuousMovement, 100); // Send movement every 100ms for held keys

window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    alert('An unexpected error occurred. Please reload the page.');
});

// Prevent context menu on right click
framework.on(document, 'contextmenu', e => e.preventDefault());

// Prevent scrolling with arrow keys
framework.on(document, 'keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
});

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', initializeApp); 