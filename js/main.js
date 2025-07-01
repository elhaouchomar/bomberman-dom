import { connectWebSocket, sendChat } from './websocket.js';
import { renderGame } from './renderer.js';
import { MiniFramework } from './framework.js';

let gameState = null;
let playerId = null;
let nickname = '';
const framework = new MiniFramework();

function showScreen(id) {
    console.log('Showing screen:', id);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
}

// Nickname join logic
const joinBtn = document.getElementById('join-btn');
const nicknameInput = document.getElementById('nickname-input');
console.log('Join button:', joinBtn);
console.log('Nickname input:', nicknameInput);

framework.on(joinBtn, 'click', tryJoin);
framework.on(nicknameInput, 'keydown', e => { if (e.key === 'Enter') tryJoin(); });

function tryJoin() {
    console.log('TryJoin called');
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
            gameState = state;
            renderGame(gameState, playerId, framework);
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
            alert(err);
        }
    });
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
}

// Chat logic
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
framework.on(chatSend, 'click', sendChatMsg);
framework.on(chatInput, 'keydown', e => { if (e.key === 'Enter') sendChatMsg(); });

function sendChatMsg() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    sendChat(msg);
    chatInput.value = '';
}

function addChat({ nickname, message }) {
    const box = document.getElementById('chat-messages');
    const d = framework.createElement('div');
    d.innerHTML = `<strong>${nickname}:</strong> ${message}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

// Handle user input and send actions
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