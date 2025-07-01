export class GameState {
  constructor() {
    this.players    = new Map();
    this.bombs      = new Map();
    this.explosions = new Map();
    this.powerups   = new Map();
    this.walls      = new Set();
    this.blocks     = new Set();

    this.mapWidth  = 800;
    this.mapHeight = 600;
    this.tileSize  = 40;
    this.gameOver  = false;
    this.currentPlayer = null;
  }

  addPlayer(id, nick, pos) {
    this.players.set(id, {
      id, nickname: nick,
      x: pos.x, y: pos.y,
      lives: 3, bombs: 1, power: 1, speed: 1,
      maxBombs: 1, activeBombs: 0, alive: true
    });
  }
  getAlivePlayers() { return [...this.players.values()].filter(p => p.alive); }

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
    function rng() {            // Mulberry32
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /* Walls */
    for (let x = 1; x < this.mapWidth / this.tileSize; x += 2)
      for (let y = 1; y < this.mapHeight / this.tileSize; y += 2)
        this.walls.add(`${x},${y}`);

    /* Blocks */
    for (let x = 0; x < this.mapWidth / this.tileSize; x++)
      for (let y = 0; y < this.mapHeight / this.tileSize; y++) {
        const key = `${x},${y}`;
        if (this.walls.has(key)) continue;

        const safe =
          (x <= 2 && y <= 2) ||
          (x >= this.mapWidth / this.tileSize - 3 && y <= 2) ||
          (x <= 2 && y >= this.mapHeight / this.tileSize - 3) ||
          (x >= this.mapWidth / this.tileSize - 3 && y >= this.mapHeight / this.tileSize - 3);
        if (safe) continue;

        if (rng() < 0.3) this.blocks.add(key);
      }
  }
}
