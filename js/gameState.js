export class GameState {
    constructor() {
        this.players = new Map();
        this.bombs = new Map();
        this.explosions = new Map();
        this.powerups = new Map();
        this.walls = new Set();
        this.blocks = new Set();
        this.mapWidth = 800;
        this.mapHeight = 600;
        this.tileSize = 40;
        this.currentPlayer = null;
        this.gameStarted = false;
        this.gameOver = false;
    }

    addPlayer(playerId, nickname, position) {
        this.players.set(playerId, {
            id: playerId,
            nickname,
            x: position.x,
            y: position.y,
            lives: 3,
            bombs: 1,
            power: 1,
            speed: 1,
            maxBombs: 1,
            activeBombs: 0,
            alive: true
        });
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
    }

    getAlivePlayers() {
        return Array.from(this.players.values()).filter(p => p.alive);
    }

    isValidPosition(x, y) {
        if (x < 0 || y < 0 || x >= this.mapWidth - 32 || y >= this.mapHeight - 32) {
            return false;
        }
        
        const tileX = Math.floor(x / this.tileSize);
        const tileY = Math.floor(y / this.tileSize);
        
        return !this.walls.has(`${tileX},${tileY}`) && 
               !this.blocks.has(`${tileX},${tileY}`);
    }

    generateMap() {
        // Generate walls (fixed pattern)
        for (let x = 1; x < this.mapWidth / this.tileSize; x += 2) {
            for (let y = 1; y < this.mapHeight / this.tileSize; y += 2) {
                this.walls.add(`${x},${y}`);
            }
        }

        // Generate random blocks
        for (let x = 0; x < this.mapWidth / this.tileSize; x++) {
            for (let y = 0; y < this.mapHeight / this.tileSize; y++) {
                if (this.walls.has(`${x},${y}`)) continue;
                
                // Don't place blocks in starting corners
                if ((x <= 2 && y <= 2) || (x >= this.mapWidth / this.tileSize - 3 && y <= 2) ||
                    (x <= 2 && y >= this.mapHeight / this.tileSize - 3) || 
                    (x >= this.mapWidth / this.tileSize - 3 && y >= this.mapHeight / this.tileSize - 3)) {
                    continue;
                }

                if (Math.random() < 0.3) {
                    this.blocks.add(`${x},${y}`);
                }
            }
        }
    }
} 