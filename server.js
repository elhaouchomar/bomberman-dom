const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// groups: {groupId: [{id,nickname,ws}]}
const groups = {};

console.log('WebSocket server started on port 8080');

/** broadcast message only to clients inside given groupId */
function broadcast(groupId, message) {
    if (!groups[groupId]) return;
    groups[groupId].forEach(p => {
        if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(message);
        }
    });
}

function broadcastPlayerList(groupId) {
    const playerList = groups[groupId].map(p => ({ id: p.id, nickname: p.nickname }));
    broadcast(groupId, JSON.stringify({ type: 'playerList', payload: playerList }));
}

/** when group reaches 4 players or after host countdown triggers */
function maybeStartGame(groupId) {
    if (!groups[groupId]) return;
    if (groups[groupId]._started) return;
    if (groups[groupId].length === 4) {
        groups[groupId]._started = true;
        broadcast(groupId, JSON.stringify({ type: 'gameStart', payload: {} }));
    }
}

wss.on('connection', ws => {
    let playerId = null;
    let groupId = null;

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join': {
                    // Assign unique id
                    playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
                    // Find group with room (<4) & not started
                    groupId = Object.keys(groups).find(
                        gid => groups[gid].length < 4 && !groups[gid]._started
                    );
                    if (!groupId) {
                        groupId = 'group_' + Date.now();
                        groups[groupId] = [];
                    }

                    const nickname = data.payload.nickname || 'Player';
                    const playerObj = { id: playerId, nickname, ws };
                    groups[groupId].push(playerObj);

                    console.log(`${nickname} (${playerId}) joined ${groupId}`);

                    // send personal confirmation
                    ws.send(JSON.stringify({ type: 'playerJoined', payload: { id: playerId, nickname } }));
                    // notify others
                    broadcast(groupId, JSON.stringify({ type: 'playerJoined', payload: { id: playerId, nickname } }));

                    broadcastPlayerList(groupId);
                    maybeStartGame(groupId);
                    break;
                }

                case 'chatMessage':
                case 'move':
                case 'placeBomb':
                case 'gameStart': // host countdown can send this
                    broadcast(groupId, message);
                    break;
                default:
                    console.log('Unknown message type', data.type);
            }
        } catch (err) {
            console.error('Failed to parse message', err);
        }
    });

    ws.on('close', () => {
        if (!groupId || !playerId) return;
        const grp = groups[groupId];
        if (!grp) return;
        const idx = grp.findIndex(p => p.id === playerId);
        if (idx !== -1) {
            const nickname = grp[idx].nickname;
            grp.splice(idx, 1);
            broadcast(groupId, JSON.stringify({ type: 'playerLeft', payload: { nickname } }));
            broadcastPlayerList(groupId);
        }
        // If group empty remove
        if (grp.length === 0) {
            delete groups[groupId];
        }
    });

    ws.on('error', err => {
        console.error('WebSocket error', err);
    });
});