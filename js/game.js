import { MiniFramework } from './framework.js';
import { WebSocketClient } from './websocket.js';
import { GameState } from './gameState.js';

export class BombermanGame {
    constructor() {
        this.framework = new MiniFramework();
        this.websocket = new WebSocketClient();
        this.gameState = new GameState();
        this.nickname = '';
        this.playerId = 'player1';
        this.playerCount = 0;
        this.waitingTimer = null;
        this.countdownTimer = null;
        this.keys = {};
        this.lastMoveTime = 0;
        this.moveInterval = 50; // milliseconds
        this.elements = new Map();

        this.init();
    }

    init() {
        this.cacheDOMElements();
        this.setupEventListeners();
        this.setupWebSocket();
    }

    cacheDOMElements() {
        this.elements.set('nicknameScreen', document.getElementById('nickname-screen'));
        this.elements.set('waitingScreen', document.getElementById('waiting-screen'));
        this.elements.set('gameScreen', document.getElementById('game-screen'));
        this.elements.set('joinBtn', document.getElementById('join-btn'));
        this.elements.set('nicknameInput', document.getElementById('nickname-input'));
        this.elements.set('playerCounter', document.getElementById('player-counter'));
        this.elements.set('countdown', document.getElementById('countdown'));
        this.elements.set('chatMessages', document.getElementById('chat-messages'));
        this.elements.set('chatInput', document.getElementById('chat-input'));
        this.elements.set('chatSend', document.getElementById('chat-send'));
        this.elements.set('gameMap', document.getElementById('game-map'));
        this.elements.set('lives', document.getElementById('lives'));
        this.elements.set('bombs', document.getElementById('bombs'));
        this.elements.set('power', document.getElementById('power'));
        this.elements.set('speed', document.getElementById('speed'));
    }

    setupEventListeners() {
        const joinBtn = this.elements.get('joinBtn');
        const nicknameInput = this.elements.get('nicknameInput');
        const chatInput = this.elements.get('chatInput');
        const chatSend = this.elements.get('chatSend');

        this.framework.on(joinBtn, 'click', () => this.joinGame());
        this.framework.on(nicknameInput, 'keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        this.framework.on(chatSend, 'click', () => this.sendChatMessage());
        this.framework.on(chatInput, 'keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // Game controls
        this.framework.on(document, 'keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === ' ') {
                e.preventDefault();
                this.placeBomb();
            }
        });

        this.framework.on(document, 'keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    setupWebSocket() {
        this.websocket.on('playerJoined', (data) => {
            this.addChatMessage('System', `${data.nickname} joined the game`);
        });

        this.websocket.on('playerList', (players) => {
            this.playerCount = players.length;
            this.updatePlayerCounter();
            
            if (this.playerCount >= 4) {
                this.startCountdown();
            } else if (this.playerCount >= 2) {
                if (!this.waitingTimer && !this.countdownTimer) {
                    this.waitingTimer = setTimeout(() => {
                        this.startCountdown();
                    }, 20000);
                }
            } else { // player count < 2
                 if (this.waitingTimer) {
                    clearTimeout(this.waitingTimer);
                    this.waitingTimer = null;
                 }
                 // If a countdown is in progress with less than 2 players, stop it.
                 if (this.countdownTimer) {
                    clearTimeout(this.countdownTimer);
                    this.countdownTimer = null;
                    this.elements.get('countdown').textContent = '';
                 }
            }
        });

        this.websocket.on('playerLeft', (data) => {
            this.addChatMessage('System', `${data.nickname} left the game`);
        });

        this.websocket.on('chatMessage', (data) => {
            this.addChatMessage(data.nickname, data.message);
        });

        this.websocket.on('gameStart', () => {
            this.startGame();
        });
    }

    joinGame() {
        const nickname = this.elements.get('nicknameInput').value.trim();
        if (!nickname) {
            alert('Please enter a nickname');
            return;
        }

        this.nickname = nickname;
        this.showScreen('waiting-screen');
        this.websocket.connect(this.nickname);
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        this.elements.get(screenId).classList.add('active');
    }

    updatePlayerCounter() {
        this.elements.get('playerCounter').textContent = `Players: ${this.playerCount}/4`;
    }

    startCountdown() {
        if (this.countdownTimer) return;

        if (this.waitingTimer) {
            clearTimeout(this.waitingTimer);
            this.waitingTimer = null;
        }

        let countdown = 10;
        const countdownElement = this.elements.get('countdown');
        
        const updateCountdown = () => {
            countdownElement.textContent = `Game starts in: ${countdown}`;
            countdown--;
            
            if (countdown < 0) {
                this.websocket.send('gameStart', {});
            } else {
                this.countdownTimer = setTimeout(updateCountdown, 1000);
            }
        };
        
        updateCountdown();
    }

    addChatMessage(nickname, message) {
        const chatMessages = this.elements.get('chatMessages');
        const messageElement = this.framework.createElement('div');
        messageElement.innerHTML = `<strong>${nickname}:</strong> ${message}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendChatMessage() {
        const chatInput = this.elements.get('chatInput');
        const message = chatInput.value.trim();
        
        if (message) {
            this.websocket.send('chatMessage', {
                nickname: this.nickname,
                message: message
            });
            chatInput.value = '';
        }
    }

    startGame() {
        this.showScreen('game-screen');
        this.gameState.generateMap();
        this.setupPlayers();
        this.renderMap();
        this.framework.startGameLoop((deltaTime) => this.gameLoop(deltaTime));
    }

    setupPlayers() {
        const positions = [
            { x: 4, y: 4 },
            { x: this.gameState.mapWidth - 36, y: 4 },
            { x: 4, y: this.gameState.mapHeight - 36 },
            { x: this.gameState.mapWidth - 36, y: this.gameState.mapHeight - 36 }
        ];

        this.gameState.addPlayer(this.playerId, this.nickname, positions[0]);
        this.gameState.currentPlayer = this.gameState.players.get(this.playerId);

        // Add AI players for demo
        for (let i = 1; i < Math.min(4, this.playerCount); i++) {
            this.gameState.addPlayer(`player${i + 1}`, `AI Player ${i + 1}`, positions[i]);
        }
    }

    renderMap() {
        const gameMap = this.elements.get('gameMap');
        gameMap.innerHTML = '';

        // Render walls
        this.gameState.walls.forEach(pos => {
            const [x, y] = pos.split(',').map(Number);
            const wall = this.framework.createElement('div', 'wall', gameMap);
            this.framework.setStyle(wall, {
                left: `${x * this.gameState.tileSize}px`,
                top: `${y * this.gameState.tileSize}px`
            });
        });

        // Render blocks
        this.gameState.blocks.forEach(pos => {
            const [x, y] = pos.split(',').map(Number);
            const block = this.framework.createElement('div', 'block', gameMap);
            this.framework.setStyle(block, {
                left: `${x * this.gameState.tileSize}px`,
                top: `${y * this.gameState.tileSize}px`
            });
        });

        // Render players
        this.gameState.players.forEach((player, playerId) => {
            if (player.alive) {
                const playerElement = this.framework.createElement('div', `player ${playerId}`, gameMap);
                playerElement.id = playerId;
                this.framework.setStyle(playerElement, {
                    left: `${player.x}px`,
                    top: `${player.y}px`
                });
            }
        });
    }

    gameLoop(deltaTime) {
        this.handleInput(deltaTime);
        this.updateBombs(deltaTime);
        this.updateExplosions(deltaTime);
        this.updateAI(deltaTime);
        this.updateUI();
        this.checkGameOver();
    }

    handleInput(deltaTime) {
        if (!this.gameState.currentPlayer || !this.gameState.currentPlayer.alive) return;

        const currentTime = Date.now();
        if (currentTime - this.lastMoveTime < this.moveInterval) return;

        const player = this.gameState.currentPlayer;
        const moveSpeed = player.speed * 2;
        let newX = player.x;
        let newY = player.y;

        if (this.keys['ArrowUp'] || this.keys['w']) newY -= moveSpeed;
        if (this.keys['ArrowDown'] || this.keys['s']) newY += moveSpeed;
        if (this.keys['ArrowLeft'] || this.keys['a']) newX -= moveSpeed;
        if (this.keys['ArrowRight'] || this.keys['d']) newX += moveSpeed;

        if (this.gameState.isValidPosition(newX, newY)) {
            player.x = newX;
            player.y = newY;
            this.updatePlayerPosition(player);
            this.lastMoveTime = currentTime;
        }
    }

    updatePlayerPosition(player) {
        const playerElement = document.getElementById(player.id);
        if (playerElement) {
            this.framework.setStyle(playerElement, {
                left: `${player.x}px`,
                top: `${player.y}px`
            });
        }
    }

    placeBomb() {
        const player = this.gameState.currentPlayer;
        if (!player || !player.alive || player.activeBombs >= player.maxBombs) return;

        const bombX = Math.floor((player.x + 16) / this.gameState.tileSize) * this.gameState.tileSize;
        const bombY = Math.floor((player.y + 16) / this.gameState.tileSize) * this.gameState.tileSize;
        const bombId = `${bombX},${bombY}`;

        if (this.gameState.bombs.has(bombId)) return;

        const bomb = {
            x: bombX,
            y: bombY,
            timer: 3000,
            power: player.power,
            owner: player.id
        };

        this.gameState.bombs.set(bombId, bomb);
        player.activeBombs++;

        const bombElement = this.framework.createElement('div', 'bomb', this.elements.get('gameMap'));
        bombElement.id = `bomb-${bombId}`;
        this.framework.setStyle(bombElement, {
            left: `${bombX + 4}px`,
            top: `${bombY + 4}px`
        });
    }

    updateBombs(deltaTime) {
        this.gameState.bombs.forEach((bomb, bombId) => {
            bomb.timer -= deltaTime;
            
            if (bomb.timer <= 0) {
                this.explodeBomb(bomb, bombId);
            }
        });
    }

    explodeBomb(bomb, bombId) {
        this.gameState.bombs.delete(bombId);
        
        const owner = this.gameState.players.get(bomb.owner);
        if (owner) owner.activeBombs--;

        // Remove bomb element
        const bombElement = document.getElementById(`bomb-${bombId}`);
        if (bombElement) bombElement.remove();

        // Create explosion
        const explosionPositions = this.getExplosionPositions(bomb.x, bomb.y, bomb.power);
        
        explosionPositions.forEach(pos => {
            const explosionId = `${pos.x},${pos.y}`;
            this.gameState.explosions.set(explosionId, {
                x: pos.x,
                y: pos.y,
                timer: 300
            });

            const explosionElement = this.framework.createElement('div', 'explosion', this.elements.get('gameMap'));
            explosionElement.id = `explosion-${explosionId}`;
            this.framework.setStyle(explosionElement, {
                left: `${pos.x}px`,
                top: `${pos.y}px`
            });

            // Check for block destruction
            const tileX = Math.floor(pos.x / this.gameState.tileSize);
            const tileY = Math.floor(pos.y / this.gameState.tileSize);
            const tileKey = `${tileX},${tileY}`;
            
            if (this.gameState.blocks.has(tileKey)) {
                this.gameState.blocks.delete(tileKey);
                document.querySelector(`.block[style*="left: ${pos.x}px"][style*="top: ${pos.y}px"]`)?.remove();
                
                // Maybe spawn powerup
                if (Math.random() < 0.3) {
                    this.spawnPowerup(pos.x, pos.y);
                }
            }

            // Check for player damage
            this.checkPlayerDamage(pos.x, pos.y);
        });
    }

    getExplosionPositions(x, y, power) {
        const positions = [{ x, y }];
        const directions = [
            { dx: 0, dy: -this.gameState.tileSize }, // up
            { dx: 0, dy: this.gameState.tileSize },  // down
            { dx: -this.gameState.tileSize, dy: 0 }, // left
            { dx: this.gameState.tileSize, dy: 0 }   // right
        ];

        directions.forEach(dir => {
            for (let i = 1; i <= power; i++) {
                const newX = x + dir.dx * i;
                const newY = y + dir.dy * i;
                
                if (newX < 0 || newY < 0 || newX >= this.gameState.mapWidth || newY >= this.gameState.mapHeight) break;
                
                const tileX = Math.floor(newX / this.gameState.tileSize);
                const tileY = Math.floor(newY / this.gameState.tileSize);
                
                if (this.gameState.walls.has(`${tileX},${tileY}`)) break;
                
                positions.push({ x: newX, y: newY });
                
                if (this.gameState.blocks.has(`${tileX},${tileY}`)) break;
            }
        });

        return positions;
    }

    checkPlayerDamage(x, y) {
        this.gameState.players.forEach(player => {
            if (!player.alive) return;
            
            const playerCenterX = player.x + 16;
            const playerCenterY = player.y + 16;
            
            if (Math.abs(playerCenterX - (x + 20)) < 20 && 
                Math.abs(playerCenterY - (y + 20)) < 20) {
                player.lives--;
                
                if (player.lives <= 0) {
                    player.alive = false;
                    const playerElement = document.getElementById(player.id);
                    if (playerElement) playerElement.remove();
                }
            }
        });
    }

    spawnPowerup(x, y) {
        const types = ['bombs', 'flames', 'speed'];
        const type = types[Math.floor(Math.random() * types.length)];
        const powerupId = `${x},${y}`;
        
        this.gameState.powerups.set(powerupId, { x, y, type });
        
        const powerupElement = this.framework.createElement('div', `powerup ${type}`, this.elements.get('gameMap'));
        powerupElement.id = `powerup-${powerupId}`;
        this.framework.setStyle(powerupElement, {
            left: `${x + 5}px`,
            top: `${y + 5}px`
        });
    }

    updateExplosions(deltaTime) {
        this.gameState.explosions.forEach((explosion, explosionId) => {
            explosion.timer -= deltaTime;
            
            if (explosion.timer <= 0) {
                this.gameState.explosions.delete(explosionId);
                const explosionElement = document.getElementById(`explosion-${explosionId}`);
                if (explosionElement) explosionElement.remove();
            }
        });
    }

    updateAI(deltaTime) {
        // Simple AI for demo purposes
        this.gameState.players.forEach(player => {
            if (player.id === this.playerId || !player.alive) return;
            
            // Random movement
            if (Math.random() < 0.02) {
                const directions = [
                    { dx: 0, dy: -2 },
                    { dx: 0, dy: 2 },
                    { dx: -2, dy: 0 },
                    { dx: 2, dy: 0 }
                ];
                
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const newX = player.x + dir.dx;
                const newY = player.y + dir.dy;
                
                if (this.gameState.isValidPosition(newX, newY)) {
                    player.x = newX;
                    player.y = newY;
                    this.updatePlayerPosition(player);
                }
            }
            
            // Random bomb placement
            if (Math.random() < 0.01 && player.activeBombs < player.maxBombs) {
                const bombX = Math.floor((player.x + 16) / this.gameState.tileSize) * this.gameState.tileSize;
                const bombY = Math.floor((player.y + 16) / this.gameState.tileSize) * this.gameState.tileSize;
                const bombId = `${bombX},${bombY}`;

                if (!this.gameState.bombs.has(bombId)) {
                    const bomb = {
                        x: bombX,
                        y: bombY,
                        timer: 3000,
                        power: player.power,
                        owner: player.id
                    };

                    this.gameState.bombs.set(bombId, bomb);
                    player.activeBombs++;

                    const bombElement = this.framework.createElement('div', 'bomb', this.elements.get('gameMap'));
                    bombElement.id = `bomb-${bombId}`;
                    this.framework.setStyle(bombElement, {
                        left: `${bombX + 4}px`,
                        top: `${bombY + 4}px`
                    });
                }
            }
        });
    }

    updateUI() {
        if (this.gameState.currentPlayer) {
            const player = this.gameState.currentPlayer;
            this.elements.get('lives').textContent = player.lives;
            this.elements.get('bombs').textContent = player.maxBombs;
            this.elements.get('power').textContent = player.power;
            this.elements.get('speed').textContent = player.speed;
            
            // Check for powerup collection
            this.checkPowerupCollection(player);
        }
    }

    checkPowerupCollection(player) {
        const playerCenterX = player.x + 16;
        const playerCenterY = player.y + 16;
        
        this.gameState.powerups.forEach((powerup, powerupId) => {
            const powerupCenterX = powerup.x + 15;
            const powerupCenterY = powerup.y + 15;
            
            if (Math.abs(playerCenterX - powerupCenterX) < 20 && 
                Math.abs(playerCenterY - powerupCenterY) < 20) {
                
                // Apply powerup effect
                switch (powerup.type) {
                    case 'bombs':
                        player.maxBombs++;
                        break;
                    case 'flames':
                        player.power++;
                        break;
                    case 'speed':
                        player.speed = Math.min(player.speed + 1, 3);
                        break;
                }
                
                // Remove powerup
                this.gameState.powerups.delete(powerupId);
                const powerupElement = document.getElementById(`powerup-${powerupId}`);
                if (powerupElement) powerupElement.remove();
            }
        });
    }

    checkGameOver() {
        const alivePlayers = this.gameState.getAlivePlayers();
        
        if (alivePlayers.length <= 1 && !this.gameState.gameOver) {
            this.gameState.gameOver = true;
            this.framework.stopGameLoop();
            
            const gameMap = this.elements.get('gameMap');
            const gameOverElement = this.framework.createElement('div', 'game-over', gameMap);
            
            let message = '';
            if (alivePlayers.length === 1) {
                const winner = alivePlayers[0];
                message = winner.id === this.playerId ? 
                    '🎉 YOU WIN! 🎉' : 
                    `🏆 ${winner.nickname} WINS! 🏆`;
            } else {
                message = '💀 GAME OVER 💀<br>No survivors!';
            }
            
            gameOverElement.innerHTML = `
                <h2>${message}</h2>
                <button class="btn" onclick="location.reload()">Play Again</button>
            `;
        }
    }
} 