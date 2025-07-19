
import { WebSocketServer, WebSocket } from 'ws';
import GameState from './game/GameState.js';

const PORT = 8081;
const MAX_PLAYERS_PER_ROOM = 4;
const MIN_PLAYERS_TO_START = 2;
const WAIT_BEFORE_COUNTDOWN_MS = 2_000;
const COUNTDOWN_MS = 1_000;
const TICK_RATE_MS = 50; 
let ROOM_SEQ = 1;
const rooms = new Map(); 

function createRoom() {
    const id = `r_${ROOM_SEQ++}`;
    const gs = new GameState();
    gs.generateMap();
    const room = {
        id,
        gameState: gs,
        stateInfo: {
            players: [],
            nextPlayerNum: 1,
            waitingTimer: null,
            waitingRemaining: 0,
            countdownTimer: null,
            countdownRemaining: 0,
            gameStarted: false,
            starCout10S: false
        },
    };
    rooms.set(id, room);
    console.log(`📦 [ROOM] created ${id}`);
    return room;
}

function findAvailableRoom() {
    for (const room of rooms.values()) {
        if (!room.stateInfo.gameStarted && room.stateInfo.players.length < MAX_PLAYERS_PER_ROOM && !room.stateInfo.starCout10S) {
            return room;
        }
    }
    return createRoom();
}



function roomBroadcast(room, msg) {
    const str = JSON.stringify(msg);
    for (const p of room.stateInfo.players) {
        if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(str);
        }
    }
}

function roomSendPlayerList(room) {
    roomBroadcast(room, {
        type: 'playerList',
        payload: room.stateInfo.players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            playerNum: p.playerNum,
        })),
    });
}

function roomStartWaiting(room) {
    const l = room.stateInfo;
    if (l.waitingTimer || l.gameStarted) return;
    l.waitingRemaining = Math.floor(WAIT_BEFORE_COUNTDOWN_MS / 1000);
    roomBroadcast(room, { type: 'waiting', payload: { waiting: l.waitingRemaining } });

    l.waitingTimer = setInterval(() => {
        l.waitingRemaining--;
        roomBroadcast(room, { type: 'waiting', payload: { waiting: l.waitingRemaining } });
        if (l.waitingRemaining <= 0) {
            clearInterval(l.waitingTimer); l.waitingTimer = null;
            if (l.players.length >= MIN_PLAYERS_TO_START && !l.gameStarted) {
                roomStartCountdown(room);
                room.stateInfo.starCout10S = true
            }
        }
    }, 1000);
}

function roomStartCountdown(room) {
    const l = room.stateInfo;
    if (l.countdownTimer || l.gameStarted) return;
    if (l.waitingTimer) { clearInterval(l.waitingTimer); l.waitingTimer = null; }
    l.countdownRemaining = Math.floor(COUNTDOWN_MS / 1000);
    roomBroadcast(room, { type: 'countdown', payload: { countdown: l.countdownRemaining } });

    l.countdownTimer = setInterval(() => {
        l.countdownRemaining--;
        roomBroadcast(room, { type: 'countdown', payload: { countdown: l.countdownRemaining } });
        if (l.countdownRemaining <= 0) {
            clearInterval(l.countdownTimer); l.countdownTimer = null;
            roomStartGame(room);
        }
    }, 1000);
}

function roomStartGame(room) {
    const l = room.stateInfo;
    if (l.gameStarted) return;
    if (l.players.length < MIN_PLAYERS_TO_START) {
        roomStartWaiting(room);
        return;
    }
    l.gameStarted = true;
    console.log(`🎮 [ROOM ${room.id}] START game (${l.players.length} players)`);

    // reset GameState
    const gs = room.gameState;
    gs.players.clear();
    gs.bombs.clear();
    gs.explosions.clear();
    gs.powerups.clear();
    gs.generateMap();

    const spawns = getSpawnPositions(gs);
    l.players.forEach((p, i) => {
        gs.addPlayer(p.id, p.nickname, spawns[i % spawns.length]);
    });

    roomBroadcast(room, { type: 'gameStart', payload: { roomId: room.id } });
}

function getSpawnPositions(gs) {
    return [
        { x: 4, y: 4 },
        { x: gs.mapWidth - 36, y: 4 },
        { x: 4, y: gs.mapHeight - 36 },
        { x: gs.mapWidth - 36, y: gs.mapHeight - 36 },
    ];
}

function roomEndGame(room, extraMsg = null) {
    const l = room.stateInfo;
    l.gameStarted = false;

    const gs = room.gameState;
    gs.players.clear();
    gs.bombs.clear();
    gs.explosions.clear();
    gs.powerups.clear();
    gs.generateMap();

    if (extraMsg) {
        roomBroadcast(room, extraMsg);
        roomBroadcast(room, { type: 'chat', payload: { nickname: 'System', message: 'Round over. Waiting for restart…' } });
        roomSendPlayerList(room);
    }

}


setInterval(() => {
    for (const room of rooms.values()) {
        const l = room.stateInfo;
        if (!l.gameStarted) continue;

        const gs = room.gameState;
        gs.tick(TICK_RATE_MS);
        roomBroadcast(room, { type: 'state', payload: gs.toJSON() });

        // winner detection
        const alive = Array.from(gs.players.values()).filter(p => p.alive);
        if (alive.length === 1) {
            const win = alive[0];

            for (const player of l.players.values()) {

                player.ws.send(JSON.stringify({
                    type: win.nickname === player.nickname ? 'win' : 'lose',
                    payload: { id: player.id, nickname: player.nickname }
                }));
            }
        } else if (alive.length === 0) {
            roomBroadcast(room, { type: 'died', payload: [] });
            console.log(`🤝 [ROOM ${room.id}] Tie`);
            roomEndGame(room);
        }
    }
}, TICK_RATE_MS);

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });
console.log(`🟢 WebSocket multi-room server running ws://localhost:${PORT}`);

// prepare rooom
if (rooms.size === 0) createRoom();

wss.on('connection', ws => {
    let myRoom = null;
    let myPlayer = null;

    ws.on('message', raw => {
        let msg; try { msg = JSON.parse(raw); } catch { return; }
        const { type, payload = {} } = msg;

        if (type === 'join' && !myPlayer) {
            const nicknameRaw = String(payload.nickname || '').trim();
            if (!nicknameRaw) {
                ws.send(JSON.stringify({ type: 'error', payload: { message: 'Nickname required.' } }));
                return;
            }

            // room selection: allow forced newRoom / roomId
            const requestedRoom = payload.roomId ? rooms.get(payload.roomId) : null;
            myRoom = (payload.newRoom ? createRoom() : null) || requestedRoom || findAvailableRoom();
            const l = myRoom.stateInfo;

            const nickLower = nicknameRaw.toLowerCase();
            const dupStateInfo = l.players.some(p => p.nickname.toLowerCase() === nickLower);
            const dupGame = l.gameStarted
                ? Array.from(myRoom.gameState.players.values()).some(p => p.nickname.toLowerCase() === nickLower && p.alive)
                : false;
            if (dupStateInfo || dupGame) {
                ws.send(JSON.stringify({ type: 'error', payload: { message: `Username "${nicknameRaw}" is taken in this room.` } }));
                return;
            }

            const playerId = 'p_' + Math.random().toString(36).slice(2, 8);
            const nickname = nicknameRaw.slice(0, 15);
            const playerNum = l.nextPlayerNum++;

            myPlayer = { id: playerId, nickname, ws, playerNum };
            l.players.push(myPlayer);
            ws.playerId = playerId;
            ws.roomId = myRoom.id;

            ws.send(JSON.stringify({ type: 'playerId', payload: { playerId, playerNum, roomId: myRoom.id } }));
            roomSendPlayerList(myRoom);
            roomBroadcast(myRoom, { type: 'chat', payload: { nickname: 'System', message: `${nickname} joined.` } });

            // timers logic
            if (l.players.length >= MAX_PLAYERS_PER_ROOM) {
                roomStartCountdown(myRoom);
            } else if (l.players.length >= MIN_PLAYERS_TO_START) {
                roomStartWaiting(myRoom);
            }
            return;
        }

        // ---------------- CHAT ----------------
        if (type === 'chat' && myRoom && myPlayer) {
            const message = String(payload.message || '').slice(0, 200);
            roomBroadcast(myRoom, { type: 'chat', payload: { nickname: myPlayer.nickname, message } });
            return;
        }

        // ---------------- ACTION ----------------
        if (type === 'action' && myRoom && myPlayer && myRoom.stateInfo.gameStarted) {
            myRoom.gameState.applyAction(myPlayer.id, payload);
            return;
        }

        // ---------------- RESTART ----------------
        if (type === 'restart') {
            myPlayer = null;
            roomEndGame(myRoom);
            ws.send(JSON.stringify({ type: 'restart' }));
            return;
        }
    });
    ws.on('close', () => {
        if (!myRoom || !myPlayer) return;
        const l = myRoom.stateInfo;
        const nick = myPlayer.nickname;

        if (l.gameStarted) {
            myRoom.gameState.removePlayer(myPlayer.id);
        } else {
            l.players = l.players.filter(p => p.id !== myPlayer.id);

            if (l.starCout10S && l.players.length < 2) {
                console.log(`[ROOM ${myRoom.id}] countdown canceled due to insufficient players`);
                if (l.countdownTimer) {
                    clearInterval(l.countdownTimer);
                    l.countdownTimer = null;
                }
                l.starCout10S = false;
                roomStartWaiting(myRoom);
            }

            // Cancel waiting/countdown if players not enough
            if (l.players.length < MIN_PLAYERS_TO_START) {
                if (l.waitingTimer) { clearInterval(l.waitingTimer); l.waitingTimer = null; }
                if (l.countdownTimer) { clearInterval(l.countdownTimer); l.countdownTimer = null; }
            }

            roomSendPlayerList(myRoom);
        }

        roomBroadcast(myRoom, {
            type: 'chat',
            payload: { nickname: 'System', message: `${nick} left.` }
        });

        setTimeout(() => {
            const currentRoom = rooms.get(myRoom.id);
            if (!currentRoom) return;
            const l2 = currentRoom.stateInfo;

            if (!l2.gameStarted && !l2.starCout10S && l2.players.length <= 0) {
                roomBroadcast(currentRoom, { type: 'restart' });
                rooms.delete(currentRoom.id);
                console.log(`🗑️ [ROOM ${currentRoom.id}] removed (empty)`);
            }
        }, 3000);
    });

});
