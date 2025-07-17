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
    console.log();
    
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
                console.log(`Removed orphaned player: ${player.nickname}`);
            }
        }
    }
}

function startWaitingTimer() {
    if (lobbyState.waitingTimer) return;
// Hide chat during gameplay
    
    console.log('Starting 20-second waiting timer...');
    let waitingTime = 20;
    
    broadcast({ type: 'waiting', payload: { waiting: waitingTime } });
    // console.log('chatOverlay3######################################', chatOverlay);
    
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
    console.log('lobbyState.gameStarted', lobbyState.gameStarted);
    
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
    console.log('a new connection is established from backend' );
    
    ws.on('message', msg => {
        console.log('message received from frontend', msg.toString());
        
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
                    console.log('playerId', playerId);
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
                        console.log('starting waiting timer');
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
        console.log('playerId1######################################', playerId);
        if (joined && playerId) {
            const nick = nickname;
            console.log('playerId2######################################', playerId);
            if (lobbyState.gameStarted) {
                console.log('playerId3######################################', playerId);
                gameState.removePlayer(playerId);
            } else {
                // Remove from lobby
                lobbyState.players = lobbyState.players.filter(p => p.id !== playerId);
                console.log('playerId4######################################', playerId);
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
        console.log('alivePlayers######################################', alivePlayers);
        console.log('totalPlayers######################################', totalPlayers);
        
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