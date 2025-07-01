import WebSocket from 'ws';
import GameState from './game/GameState.js';

const wss = new WebSocket.Server({ port: 8081 });
const gameState = new GameState();

const spawnPositions = [
    { x: 4, y: 4 },
    { x: gameState.mapWidth - 36, y: 4 },
    { x: 4, y: gameState.mapHeight - 36 },
    { x: gameState.mapWidth - 36, y: gameState.mapHeight - 36 }
];
let nextPlayerNum = 1;

// Lobby state
let lobbyState = {
    players: [],
    waitingTimer: null,
    countdownTimer: null,
    countdown: 10,
    gameStarted: false
};

gameState.generateMap(Math.floor(Math.random() * 1e9));

function broadcast(msg) {
    const str = JSON.stringify(msg);
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(str);
    });
}

function sendPlayerList() {
    const list = lobbyState.players.map(p => ({
        id: p.id, nickname: p.nickname
    }));
    broadcast({ type: 'playerList', payload: list });
}

function startWaitingTimer() {
    if (lobbyState.waitingTimer) return;

    console.log('Starting 20-second waiting timer...');
    let waitingTime = 20;
    broadcast({ type: 'waiting', payload: { waiting: waitingTime } });

    lobbyState.waitingTimer = setInterval(() => {
        waitingTime--;
        console.log(`Waiting: ${waitingTime} seconds remaining`);
        broadcast({ type: 'waiting', payload: { waiting: waitingTime } });

        if (waitingTime <= 0) {
            clearInterval(lobbyState.waitingTimer);
            lobbyState.waitingTimer = null;
            if (lobbyState.players.length >= 2 && lobbyState.players.length < 4 && !lobbyState.gameStarted) {
                console.log('20-second waiting period ended, starting countdown...');
                startCountdown();
            }
        }
    }, 1000);
}

function startCountdown() {
    if (lobbyState.countdownTimer) return;

    clearTimeout(lobbyState.waitingTimer);
    lobbyState.waitingTimer = null;

    console.log('Starting 10-second countdown...');
    lobbyState.countdown = 10;
    broadcast({ type: 'countdown', payload: { countdown: lobbyState.countdown } });

    lobbyState.countdownTimer = setInterval(() => {
        lobbyState.countdown--;
        console.log(`Countdown: ${lobbyState.countdown}`);
        broadcast({ type: 'countdown', payload: { countdown: lobbyState.countdown } });

        if (lobbyState.countdown <= 0) {
            startGame();
        }
    }, 1000);
}

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

wss.on('connection', ws => {
    let playerId = null;
    let nickname = null;
    let joined = false;

    ws.on('message', msg => {
        try {
            const { type, payload } = JSON.parse(msg);
            if (!joined) {
                if (type === 'join' && payload.nickname) {
                    // Check if lobby is full
                    if (lobbyState.players.length >= 4) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Lobby is full (4/4 players)' } }));
                        ws.close();
                        return;
                    }

                    playerId = 'p_' + Math.random().toString(36).slice(2, 8);
                    nickname = payload.nickname.slice(0, 15);

                    // Add to lobby
                    lobbyState.players.push({ id: playerId, nickname });
                    ws.playerId = playerId;
                    joined = true;

                    ws.send(JSON.stringify({ type: 'playerId', payload: playerId }));
                    sendPlayerList();
                    broadcast({ type: 'chat', payload: { nickname: 'System', message: `${nickname} joined` } });

                    // Check if we should start waiting timer or countdown
                    if (lobbyState.players.length >= 4) {
                        // 4 players reached, start countdown immediately
                        clearTimeout(lobbyState.waitingTimer);
                        lobbyState.waitingTimer = null;
                        startCountdown();
                    } else if (lobbyState.players.length >= 2) {
                        // 2+ players but less than 4, start waiting timer
                        startWaitingTimer();
                    }
                }
                return;
            }

            if (lobbyState.gameStarted) {
                if (type === 'action') {
                    gameState.applyAction(playerId, payload);
                } else if (type === 'chat' && payload.message) {
                    broadcast({ type: 'chat', payload: { nickname, message: payload.message.slice(0, 200) } });
                }
            }
        } catch (err) {
            // Ignore malformed messages
        }
    });

    ws.on('close', () => {
        if (joined && playerId) {
            const nick = nickname;

            if (lobbyState.gameStarted) {
                gameState.removePlayer(playerId);
            } else {
                // Remove from lobby
                lobbyState.players = lobbyState.players.filter(p => p.id !== playerId);

                // If not enough players, stop timers
                if (lobbyState.players.length < 2) {
                    clearTimeout(lobbyState.waitingTimer);
                    clearInterval(lobbyState.countdownTimer);
                    lobbyState.waitingTimer = null;
                    lobbyState.countdownTimer = null;
                }

                sendPlayerList();
            }

            broadcast({ type: 'chat', payload: { nickname: 'System', message: `${nick} left` } });
        }
    });
});

// Game loop: tick and broadcast state (only when game is started)
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

console.log('🟢 WebSocket server running on :8081'); 