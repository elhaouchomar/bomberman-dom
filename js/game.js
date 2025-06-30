import { MiniFramework } from './framework.js';
import { WebSocketClient } from './websocket.js';
import { GameState } from './gameState.js';

export class BombermanGame {
    constructor() {
        this.framework = new MiniFramework();
        this.websocket = new WebSocketClient();
        this.gameState = new GameState();

        this.nickname = '';
        this.playerId = 'player1';   // يُستبدل بعد join
        this.playerIdSet = false;    // نتفادى تعيينه مرّتين

        this.playerCount = 0;
        this.waitingTimer = null;
        this.countdownTimer = null;

        this.keys = {};
        this.lastMoveTime = 0;
        this.moveInterval = 50;      // ms

        this.elements = new Map();

        this.init();
    }

    /* ---------- bootstrap ---------- */

    init() {
        this.cacheDOMElements();
        this.setupEventListeners();
        this.setupWebSocket();
    }

    cacheDOMElements() {
        const ids = [
            'nickname-screen', 'waiting-screen', 'game-screen',
            'join-btn', 'nickname-input', 'player-counter', 'countdown',
            'chat-messages', 'chat-input', 'chat-send',
            'game-map', 'lives', 'bombs', 'power', 'speed'
        ];
        ids.forEach(id => this.elements.set(id, document.getElementById(id)));
    }

    /* ---------- events ---------- */

    setupEventListeners() {
        const $ = id => this.elements.get(id);

        this.framework.on($('join-btn'), 'click', () => this.joinGame());
        this.framework.on($('nickname-input'), 'keypress', e => e.key === 'Enter' && this.joinGame());

        this.framework.on($('chat-send'), 'click', () => this.sendChatMessage());
        this.framework.on($('chat-input'), 'keypress', e => e.key === 'Enter' && this.sendChatMessage());

        // movement + bomb
        this.framework.on(document, 'keydown', e => {
            this.keys[e.key] = true;
            if (e.key === ' ') {
                e.preventDefault();
                this.placeBomb();
            }
        });
        this.framework.on(document, 'keyup', e => (this.keys[e.key] = false));
    }

    /* ---------- WebSocket ---------- */

    setupWebSocket() {
        /* basic lobby events */
        this.websocket.on('playerJoined', data => {
            // أول رسالة تخصّنا سنأخذ منها id
            if (data.nickname === this.nickname && !this.playerIdSet) {
                this.playerId = data.id;
                this.playerIdSet = true;
            }
            this.addChatMessage('System', `${data.nickname} joined the game`);
        });

        this.websocket.on('playerLeft', data =>
            this.addChatMessage('System', `${data.nickname} left the game`)
        );

        this.websocket.on('chatMessage', data =>
            this.addChatMessage(data.nickname, data.message)
        );

        this.websocket.on('playerList', players => {
            this.playerCount = players.length;
            this.updatePlayerCounter();

            /* countdown logic */
            if (this.playerCount >= 4) {
                this.startCountdown();
            } else if (this.playerCount >= 2) {
                if (!this.waitingTimer && !this.countdownTimer) {
                    this.waitingTimer = setTimeout(() => this.startCountdown(), 20_000);
                }
            } else {
                clearTimeout(this.waitingTimer);
                this.waitingTimer = null;

                clearTimeout(this.countdownTimer);
                this.countdownTimer = null;
                this.elements.get('countdown').textContent = '';
            }
        });

        /* realtime game events */
        this.websocket.on('move', data => {
            if (data.id === this.playerId) return;          // نتجاهل حركتنا
            const p = this.gameState.players.get(data.id);
            if (p) {
                p.x = data.x;
                p.y = data.y;
                this.updatePlayerPosition(p);
            }
        });

        this.websocket.on('placeBomb', data => {
            if (data.id === this.playerId) return;
            this.placeBombAt(data.id, data.x, data.y);
        });

        this.websocket.on('gameStart', () => this.startGame());
    }

    /* ---------- lobby ---------- */

    joinGame() {
        const nickname = this.elements.get('nickname-input').value.trim();
        if (!nickname) return alert('Please enter a nickname');

        this.nickname = nickname;
        this.showScreen('waiting-screen');
        this.websocket.connect(this.nickname);
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(screenId);
        if (el) el.classList.add('active');
    }

    updatePlayerCounter() {
        this.elements.get('player-counter').textContent = `Players: ${this.playerCount}/4`;
    }

    startCountdown() {
        if (this.countdownTimer) return;
        clearTimeout(this.waitingTimer);

        let n = 10;
        const $count = this.elements.get('countdown');

        const tick = () => {
            $count.textContent = `Game starts in: ${n}`;
            if (n-- <= 0) {
                this.websocket.send('gameStart', {});
            } else {
                this.countdownTimer = setTimeout(tick, 1000);
            }
        };
        tick();
    }

    addChatMessage(nick, msg) {
        const box = this.elements.get('chat-messages');
        const div = this.framework.createElement('div');
        div.innerHTML = `<strong>${nick}:</strong> ${msg}`;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    sendChatMessage() {
        const input = this.elements.get('chat-input');
        const msg = input.value.trim();
        if (!msg) return;
        this.websocket.send('chatMessage', { nickname: this.nickname, message: msg });
        input.value = '';
    }

    /* ---------- game start ---------- */

    startGame() {
        this.showScreen('game-screen');
        this.gameState.generateMap();
        this.setupPlayers();
        this.renderMap();
        this.framework.startGameLoop(dt => this.gameLoop(dt));
    }

    setupPlayers() {
        const pos = [
            { x: 4, y: 4 },
            { x: this.gameState.mapWidth - 36, y: 4 },
            { x: 4, y: this.gameState.mapHeight - 36 },
            { x: this.gameState.mapWidth - 36, y: this.gameState.mapHeight - 36 }
        ];

        this.gameState.addPlayer(this.playerId, this.nickname, pos[0]);
        this.gameState.currentPlayer = this.gameState.players.get(this.playerId);

        // مؤقتاً: AIs لملء الخانات الفارغة
        for (let i = 1; i < Math.min(4, this.playerCount); i++) {
            this.gameState.addPlayer(`player${i + 1}`, `AI ${i + 1}`, pos[i]);
        }
    }

    /* ---------- render ---------- */

    renderMap() {
        const map = this.elements.get('game-map');
        map.innerHTML = '';

        // walls
        this.gameState.walls.forEach(p => {
            const [x, y] = p.split(',').map(Number);
            const w = this.framework.createElement('div', 'wall', map);
            this.framework.setStyle(w, { left: `${x * 40}px`, top: `${y * 40}px` });
        });

        // blocks
        this.gameState.blocks.forEach(p => {
            const [x, y] = p.split(',').map(Number);
            const b = this.framework.createElement('div', 'block', map);
            this.framework.setStyle(b, { left: `${x * 40}px`, top: `${y * 40}px` });
        });

        // players
        this.gameState.players.forEach(pl => {
            if (!pl.alive) return;
            const el = this.framework.createElement('div', `player ${pl.id}`, map);
            el.id = pl.id;
            this.framework.setStyle(el, { left: `${pl.x}px`, top: `${pl.y}px` });
        });
    }

    /* ---------- game loop ---------- */

    gameLoop(dt) {
        this.handleInput(dt);
        this.updateBombs(dt);
        this.updateExplosions(dt);
        this.updateAI(dt);
        this.updateUI();
        this.checkGameOver();
    }

    /* ----- input ----- */

    handleInput() {
        const p = this.gameState.currentPlayer;
        if (!p || !p.alive) return;

        const now = Date.now();
        if (now - this.lastMoveTime < this.moveInterval) return;

        const speed = p.speed * 2;
        let nx = p.x, ny = p.y;
        if (this.keys['ArrowUp'] || this.keys['w']) ny -= speed;
        if (this.keys['ArrowDown'] || this.keys['s']) ny += speed;
        if (this.keys['ArrowLeft'] || this.keys['a']) nx -= speed;
        if (this.keys['ArrowRight'] || this.keys['d']) nx += speed;

        if (this.gameState.isValidPosition(nx, ny)) {
            p.x = nx; p.y = ny;
            this.updatePlayerPosition(p);
            this.lastMoveTime = now;
            /* broadcast move */
            this.websocket.send('move', { id: p.id, x: p.x, y: p.y });
        }
    }

    updatePlayerPosition(p) {
        const el = document.getElementById(p.id);
        if (el) this.framework.setStyle(el, { left: `${p.x}px`, top: `${p.y}px` });
    }

    /* ----- bombs ----- */

    placeBomb() {
        const p = this.gameState.currentPlayer;
        if (!p || !p.alive || p.activeBombs >= p.maxBombs) return;

        const bx = Math.floor((p.x + 16) / 40) * 40;
        const by = Math.floor((p.y + 16) / 40) * 40;
        this.placeBombAt(p.id, bx, by);
        /* broadcast */
        this.websocket.send('placeBomb', { id: p.id, x: bx, y: by });
    }

    placeBombAt(ownerId, x, y) {
        const p = this.gameState.players.get(ownerId);
        if (!p || !p.alive || p.activeBombs >= p.maxBombs) return;

        const bId = `${x},${y}`;
        if (this.gameState.bombs.has(bId)) return;

        this.gameState.bombs.set(bId, { x, y, timer: 3000, power: p.power, owner: ownerId });
        p.activeBombs++;

        const el = this.framework.createElement('div', 'bomb', this.elements.get('game-map'));
        el.id = `bomb-${bId}`;
        this.framework.setStyle(el, { left: `${x + 4}px`, top: `${y + 4}px` });
    }

    updateBombs(dt) {
        this.gameState.bombs.forEach((b, id) => {
            b.timer -= dt;
            if (b.timer <= 0) this.explodeBomb(b, id);
        });
    }

    explodeBomb(b, id) {
        this.gameState.bombs.delete(id);
        const owner = this.gameState.players.get(b.owner);
        if (owner) owner.activeBombs--;

        document.getElementById(`bomb-${id}`)?.remove();

        const cells = this.getExplosionPositions(b.x, b.y, b.power);
        cells.forEach(pos => {
            const eId = `${pos.x},${pos.y}`;
            this.gameState.explosions.set(eId, { ...pos, timer: 300 });

            const ex = this.framework.createElement('div', 'explosion', this.elements.get('game-map'));
            ex.id = `explosion-${eId}`;
            this.framework.setStyle(ex, { left: `${pos.x}px`, top: `${pos.y}px` });

            /* block destruction & powerup */
            const cellKey = `${pos.x / 40},${pos.y / 40}`;
            if (this.gameState.blocks.has(cellKey)) {
                this.gameState.blocks.delete(cellKey);
                document.querySelector(`.block[style*="left: ${pos.x}px"][style*="top: ${pos.y}px"]`)?.remove();
                if (Math.random() < 0.3) this.spawnPowerup(pos.x, pos.y);
            }
            this.checkPlayerDamage(pos.x, pos.y);
        });
    }

    getExplosionPositions(x, y, power) {
        const res = [{ x, y }];
        const dirs = [{dx:0,dy:-40},{dx:0,dy:40},{dx:-40,dy:0},{dx:40,dy:0}];
        dirs.forEach(d => {
            for (let i = 1; i <= power; i++) {
                const nx = x + d.dx * i, ny = y + d.dy * i;
                if (nx<0||ny<0||nx>=this.gameState.mapWidth||ny>=this.gameState.mapHeight) break;
                const cell = `${nx/40},${ny/40}`;
                if (this.gameState.walls.has(cell)) break;
                res.push({x:nx,y:ny});
                if (this.gameState.blocks.has(cell)) break;
            }
        });
        return res;
    }

    updateExplosions(dt) {
        this.gameState.explosions.forEach((ex, id) => {
            ex.timer -= dt;
            if (ex.timer <= 0) {
                this.gameState.explosions.delete(id);
                document.getElementById(`explosion-${id}`)?.remove();
            }
        });
    }

    /* ----- AI (demo) ----- */

    updateAI() {
        // very simple random AI
        this.gameState.players.forEach(p => {
            if (p.id === this.playerId || !p.alive) return;
            if (Math.random() < 0.02) {
                const dirs = [{dx:0,dy:-2},{dx:0,dy:2},{dx:-2,dy:0},{dx:2,dy:0}];
                const d = dirs[Math.floor(Math.random()*dirs.length)];
                const nx = p.x + d.dx, ny = p.y + d.dy;
                if (this.gameState.isValidPosition(nx,ny)) {
                    p.x = nx; p.y = ny;
                    this.updatePlayerPosition(p);
                }
            }
            if (Math.random() < 0.01 && p.activeBombs < p.maxBombs) {
                const bx = Math.floor((p.x+16)/40)*40;
                const by = Math.floor((p.y+16)/40)*40;
                this.placeBombAt(p.id,bx,by);
            }
        });
    }

    /* ----- UI & endgame ----- */

    updateUI() {
        const p = this.gameState.currentPlayer;
        if (!p) return;
        this.elements.get('lives').textContent = p.lives;
        this.elements.get('bombs').textContent = p.maxBombs;
        this.elements.get('power').textContent = p.power;
        this.elements.get('speed').textContent = p.speed;
        this.checkPowerupCollection(p);
    }

    checkPowerupCollection(p) {
        const cx = p.x + 16, cy = p.y + 16;
        this.gameState.powerups.forEach((pu,id)=>{
            const pcx = pu.x+15, pcy = pu.y+15;
            if (Math.abs(cx-pcx)<20 && Math.abs(cy-pcy)<20){
                switch(pu.type){
                    case 'bombs': p.maxBombs++; break;
                    case 'flames': p.power++; break;
                    case 'speed': p.speed = Math.min(p.speed+1,3); break;
                }
                this.gameState.powerups.delete(id);
                document.getElementById(`powerup-${id}`)?.remove();
            }
        });
    }

    checkPlayerDamage(x,y){
        this.gameState.players.forEach(p=>{
            if(!p.alive) return;
            const cX = p.x+16, cY = p.y+16;
            if (Math.abs(cX-(x+20))<20 && Math.abs(cY-(y+20))<20){
                if(--p.lives<=0){
                    p.alive=false;
                    document.getElementById(p.id)?.remove();
                }
            }
        });
    }

    spawnPowerup(x,y){
        const types=['bombs','flames','speed'];
        const t = types[Math.floor(Math.random()*types.length)];
        const id = `${x},${y}`;
        this.gameState.powerups.set(id,{x,y,type:t});
        const el = this.framework.createElement('div',`powerup ${t}`,this.elements.get('game-map'));
        el.id=`powerup-${id}`;
        this.framework.setStyle(el,{left:`${x+5}px`,top:`${y+5}px`});
    }

    checkGameOver(){
        const alive = this.gameState.getAlivePlayers();
        if(alive.length>1||this.gameState.gameOver) return;
        this.gameState.gameOver=true;
        this.framework.stopGameLoop();

        const map = this.elements.get('game-map');
        const box = this.framework.createElement('div','game-over',map);
        let msg='';
        if(alive.length===1){
            const w=alive[0];
            msg = w.id===this.playerId ? '🎉 YOU WIN! 🎉' : `🏆 ${w.nickname} WINS! 🏆`;
        } else {
            msg='💀 GAME OVER 💀<br>No survivors!';
        }
        box.innerHTML=`<h2>${msg}</h2><button class="btn" onclick="location.reload()">Play Again</button>`;
    }
}
