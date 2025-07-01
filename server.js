const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const players = {};
let mapSeed = null;          

function broadcast(msg) {
  wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
}
function sendPlayerList() {
  const list = Object.values(players).map(p => ({
    id: p.id, nickname: p.nickname, slot: p.slot
  }));
  broadcast(JSON.stringify({ type: 'playerList', payload: list }));
}
function nextSlot() { return Object.keys(players).length % 4; }

wss.on('connection', ws => {
  let myId = null;

  ws.on('message', raw => {
    try {

        const { type, payload } = JSON.parse(raw);

    switch (type) {
      case 'join': {
        myId = 'p_' + Math.random().toString(36).slice(2, 6);
        players[myId] = {
          id: myId,
          nickname: payload.nickname,
          slot: nextSlot(),
          ws
        };
        broadcast(JSON.stringify({
          type: 'playerJoined',
          payload: { id: myId, nickname: payload.nickname, slot: players[myId].slot }
        }));
        sendPlayerList();
        break;
      }

      case 'chatMessage':
      case 'move':
      case 'placeBomb':
        broadcast(raw);
        break;

      case 'gameStart':
        if (!mapSeed) mapSeed = Math.floor(Math.random() * 1e9);
        broadcast(JSON.stringify({ type: 'gameStart', payload: { mapSeed } }));
        break;
    }
}catch(_){
    
}
  });

  ws.on('close', () => {
    if (!myId) return;
    const nick = players[myId].nickname;
    delete players[myId];
    broadcast(JSON.stringify({ type: 'playerLeft', payload: { nickname: nick } }));
    sendPlayerList();
    if (Object.keys(players).length === 0) mapSeed = null;
  });
});

console.log('🟢 WebSocket server running on :8080');
