import { WebSocketServer, WebSocket } from 'ws';
import GameState from './game/GameState.js';

const wss = new WebSocketServer({ port: 8081, host: '0.0.0.0' });
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

gameState.generateMap();

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

function cleanupOrphanedPlayers() {
    // Remove players from game state who are no longer connected
    if (lobbyState.gameStarted) {
        const connectedPlayerIds = new Set();
        wss.clients.forEach(client => {
            if (client.playerId) {
                connectedPlayerIds.add(client.playerId);
            }
        });
        
        // Remove players from game state who are not connected
        for (const [playerId, player] of gameState.players.entries()) {
            if (!connectedPlayerIds.has(playerId)) {
                gameState.players.delete(playerId);
            }
        }
    }
}

function startWaitingTimer() {
    if (lobbyState.waitingTimer) return;
// Hide chat during gameplay
    
    let waitingTime = 7;
    
    broadcast({ type: 'waiting', payload: { waiting: waitingTime } });
    
    lobbyState.waitingTimer = setInterval(() => {
        waitingTime--;
        broadcast({ type: 'waiting', payload: { waiting: waitingTime } });

        if (waitingTime <= 0) {
            clearInterval(lobbyState.waitingTimer);
            lobbyState.waitingTimer = null;
            if (lobbyState.players.length >= 2 && lobbyState.players.length < 4 && !lobbyState.gameStarted) {
                startCountdown();
            }
        }
    }, 1000);
    
}

function startCountdown() {
    if (lobbyState.countdownTimer) return;

    clearTimeout(lobbyState.waitingTimer);
    lobbyState.waitingTimer = null;

    lobbyState.countdown = 3;
    broadcast({ type: 'countdown', payload: { countdown: lobbyState.countdown } });

    lobbyState.countdownTimer = setInterval(() => {
        lobbyState.countdown--;
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

                    // Clean up orphaned players first
                    cleanupOrphanedPlayers();
                    
                    // Check for duplicate username (only in lobby and active game players)
                    const trimmedNickname = payload.nickname.trim();
                    const isDuplicateInLobby = lobbyState.players.some(player => 
                        player.nickname.toLowerCase() === trimmedNickname.toLowerCase()
                    );
                    
                    // Only check game state if game is actually running and has active players
                    const isDuplicateInGame = lobbyState.gameStarted && 
                        Array.from(gameState.players.values()).some(player => 
                            player.nickname.toLowerCase() === trimmedNickname.toLowerCase() && player.alive
                        );
                    
                    if (isDuplicateInLobby || isDuplicateInGame) {
                        ws.send(JSON.stringify({ 
                            type: 'error', 
                            payload: { message: `Username "${trimmedNickname}" is already taken. Please choose a different name.` } 
                        }));
                        // Don't close connection, let client handle the error
                        return;
                    }

                    playerId = 'p_' + Math.random().toString(36).slice(2, 8);
                    nickname = trimmedNickname.slice(0, 15);

                    // Add to lobby
                    lobbyState.players.push({ id: playerId, nickname });
                    ws.playerId = playerId;
                    joined = true;
                    ws.send(JSON.stringify({ type: 'playerId', payload: playerId }));
                    sendPlayerList();
                    broadcast({ type: 'chat', payload: { nickname: 'System', message: `${nickname} joined` } });
                    broadcast({type:'waiting', payload: {waiting: 20}})

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

            if (type === 'chat' && payload.message) {
                broadcast({ type: 'chat', payload: { nickname, message: payload.message.slice(0, 200) } });
            } else if (lobbyState.gameStarted && type === 'action') {
                gameState.applyAction(playerId, payload);
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

        // Winner detection
        const alivePlayers = Array.from(gameState.players.values()).filter(p => p.alive);
        const totalPlayers = gameState.players.size;
        
        if (alivePlayers.length === 1 ) {
            // Single winner
            const winner = alivePlayers[0];
            broadcast({ type: 'winner', payload: { id: winner.id, nickname: winner.nickname } });
            endGame();
        } else if (alivePlayers.length === 0) {
            // All players died simultaneously - it's a tie
            broadcast({ type: 'winner', payload: { id: null, nickname: 'TIE - All players died!' } });
            endGame();
        }
    }
}, TICK_RATE);

function endGame() {
    lobbyState.gameStarted = false;
    
    // Clear all players from game state when game ends
    gameState.players.clear();
    gameState.bombs.clear();
    gameState.explosions.clear();
    gameState.powerups.clear();
    
    // Reset lobby for new game
    lobbyState.players = [];
    broadcast({ type: 'chat', payload: { nickname: 'System', message: 'Game ended. Lobby reset for new game.' } });
}

console.log('🟢 WebSocket server running on :8081'); 