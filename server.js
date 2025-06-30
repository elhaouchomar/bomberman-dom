const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let players = {};

console.log('WebSocket server started on port 8080');

function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function broadcastPlayerList() {
    const playerList = Object.values(players).map(p => ({ id: p.id, nickname: p.nickname }));
    broadcast(JSON.stringify({ type: 'playerList', payload: playerList }));
}

wss.on('connection', ws => {
    let playerId = null;

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join':
                    // A unique ID is better than using the number of players
                    playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    console.log(`${data.payload.nickname} (${playerId}) connected`);
                    players[playerId] = { id: playerId, nickname: data.payload.nickname, ws };
                    
                    broadcast(JSON.stringify({
                        type: 'playerJoined',
                        payload: { nickname: data.payload.nickname }
                    }));
                    broadcastPlayerList();
                    break;
                
                case 'chatMessage':
                case 'gameStart':
                    broadcast(message);
                    break;
                
                default:
                    console.log(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error('Failed to parse message or broadcast:', error);
        }
    });

    ws.on('close', () => {
        if (playerId && players[playerId]) {
            const { nickname } = players[playerId];
            console.log(`${nickname} disconnected`);
            delete players[playerId];
            broadcast(JSON.stringify({ type: 'playerLeft', payload: { nickname } }));
            broadcastPlayerList();
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
}); 