class GameState {
    constructor() {
        this.players = new Map();
        this.bombs = new Map();
        this.explosions = new Map();
        this.walls = new Set();
        this.blocks = new Set();
        this.mapWidth = 800;
        this.mapHeight = 600;
        this.tileSize = 40;
    }

    addPlayer(id, nickname, pos) {
        this.players.set(id, {
            id, nickname,
            x: pos.x, y: pos.y,
            lives: 3, bombs: 1, power: 1, speed: 1,
            maxBombs: 1, activeBombs: 0, alive: true
        });
    }
    removePlayer(id) {
        this.players.delete(id);
    }

    isValidPosition(x, y) {
        if (x < 0 || y < 0 || x + 31 >= this.mapWidth || y + 31 >= this.mapHeight) return false;
        const corners = [
            [x, y], [x + 31, y], [x, y + 31], [x + 31, y + 31]
        ];
        return corners.every(([cx, cy]) => {
            const key = `${Math.floor(cx / this.tileSize)},${Math.floor(cy / this.tileSize)}`;
            return !this.walls.has(key) && !this.blocks.has(key);
        });
    }

    generateMap(seed) {
        function rng() { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
        for (let x = 1; x < this.mapWidth / this.tileSize; x += 2)
            for (let y = 1; y < this.mapHeight / this.tileSize; y += 2)
                this.walls.add(`${x},${y}`);
        for (let x = 0; x < this.mapWidth / this.tileSize; x++)
            for (let y = 0; y < this.mapHeight / this.tileSize; y++) {
                const key = `${x},${y}`;
                if (this.walls.has(key)) continue;
                const safe = (x <= 2 && y <= 2) ||
                    (x >= this.mapWidth / this.tileSize - 3 && y <= 2) ||
                    (x <= 2 && y >= this.mapHeight / this.tileSize - 3) ||
                    (x >= this.mapWidth / this.tileSize - 3 && y >= this.mapHeight / this.tileSize - 3);
                if (safe) continue;
                if (rng() < 0.3) this.blocks.add(key);
            }
    }

    applyAction(playerId, action) {
        const player = this.players.get(playerId);
        if (!player || !player.alive) return;
        switch (action.type) {
            case 'move': {
                const { dx, dy } = action;
                const speed = player.speed * 2;
                const nx = player.x + (dx * speed);
                const ny = player.y + (dy * speed);
                if (this.isValidPosition(nx, ny)) {
                    player.x = nx;
                    player.y = ny;
                }
                break;
            }
            case 'placeBomb': {
                if (player.activeBombs >= player.maxBombs) return;
                const bx = Math.floor((player.x + 16) / this.tileSize) * this.tileSize;
                const by = Math.floor((player.y + 16) / this.tileSize) * this.tileSize;
                const id = `${bx},${by}`;
                if (this.bombs.has(id)) return;
                this.bombs.set(id, {
                    x: bx, y: by, timer: 3000, power: player.power, owner: player.id
                });
                player.activeBombs++;
                break;
            }
        }
    }

    tick(dt) {
        // Bomb timers and explosions
        for (const [id, bomb] of Array.from(this.bombs.entries())) {
            bomb.timer -= dt;
            if (bomb.timer <= 0) this.explodeBomb(bomb, id);
        }
        for (const [id, explosion] of Array.from(this.explosions.entries())) {
            explosion.timer -= dt;
            if (explosion.timer <= 0) this.explosions.delete(id);
        }
    }

    explodeBomb(bomb, id) {
        this.bombs.delete(id);
        const owner = this.players.get(bomb.owner);
        if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);
        const explosionArea = this.getExplosionArea(bomb.x, bomb.y, bomb.power);
        for (const pos of explosionArea) {
            const eId = `${pos.x},${pos.y}`;
            this.explosions.set(eId, { ...pos, timer: 300 });
            const cell = `${pos.x / this.tileSize},${pos.y / this.tileSize}`;
            if (this.blocks.has(cell)) this.blocks.delete(cell);
            this.checkPlayerDamage(pos.x, pos.y);
            const bombId = `${pos.x},${pos.y}`;
            if (this.bombs.has(bombId)) this.explodeBomb(this.bombs.get(bombId), bombId);
        }
    }

    getExplosionArea(x, y, power) {
        const arr = [{ x, y }];
        const dirs = [[0, -this.tileSize], [0, this.tileSize], [-this.tileSize, 0], [this.tileSize, 0]];
        for (const [dx, dy] of dirs) {
            for (let i = 1; i <= power; i++) {
                const nx = x + dx * i, ny = y + dy * i;
                if (nx < 0 || ny < 0 || nx >= this.mapWidth || ny >= this.mapHeight) break;
                const cell = `${nx / this.tileSize},${ny / this.tileSize}`;
                if (this.walls.has(cell)) break;
                arr.push({ x: nx, y: ny });
                if (this.blocks.has(cell)) break;
            }
        }
        return arr;
    }

    checkPlayerDamage(x, y) {
        for (const player of this.players.values()) {
            if (!player.alive) continue;
            const cx = player.x + 16, cy = player.y + 16;
            if (Math.abs(cx - (x + 20)) < 20 && Math.abs(cy - (y + 20)) < 20) {
                player.lives--;
                if (player.lives <= 0) player.alive = false;
            }
        }
    }

    toJSON() {
        return {
            players: Array.from(this.players.values()),
            bombs: Array.from(this.bombs.values()),
            explosions: Array.from(this.explosions.values()),
            walls: Array.from(this.walls),
            blocks: Array.from(this.blocks),
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight,
            tileSize: this.tileSize
        };
    }
}

export default GameState; 