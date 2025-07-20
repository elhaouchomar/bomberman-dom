class GameState {
  constructor() {
    this.mapWidth = 760;
    this.mapHeight = 600;
    this.tileSize = 40;
    this.playerSize = 32;

    this.players = new Map(); // id   → player‑object
    this.bombs = new Map(); // "x,y"→ bomb
    this.explosions = new Map();
    this.powerups = new Map();
    this.walls = new Set(); // "gx,gy"
    this.blocks = new Set(); // "gx,gy"

    this.generateMap();
  }


  isValidPosition(x, y, selfId = null) {
    const s = this.playerSize - 1;
    if (x < 0 || y < 0 || x + s >= this.mapWidth || y + s >= this.mapHeight) return false;

    const ok = (cx, cy) => {
      const key = `${Math.floor(cx / this.tileSize)},${Math.floor(cy / this.tileSize)}`;
      return !this.walls.has(key) && !this.blocks.has(key);
    };
    if (!ok(x, y) || !ok(x + s, y) || !ok(x, y + s) || !ok(x + s, y + s)) return false;

    for (const bomb of this.bombs.values()) {
      if (selfId && bomb.owner === selfId) continue;
      if (
        x + s > bomb.x && x < bomb.x + this.tileSize &&
        y + s > bomb.y && y < bomb.y + this.tileSize
      ) return false;
    }

    for (const other of this.players.values()) {
      if (!other.alive) continue;
      if (selfId && other.id === selfId) continue;
      if (
        x + s > other.x && x < other.x + this.playerSize &&
        y + s > other.y && y < other.y + this.playerSize
      ) return false;
    }

    return true;
  }

  trySlideY(p, tol, stepX) {
    for (let s = 1; s <= tol; s++) {
      for (const dy of [-s, s]) {
        if (this.isValidPosition(p.x, p.y + dy, p.id)) {
          p.y += dy;
          if (this.isValidPosition(p.x + stepX, p.y, p.id)) p.x += stepX;
          return dy;
        }
      }
    }
    return 0;
  }
  trySlideX(p, tol, stepY) {
    for (let s = 1; s <= tol; s++) {
      for (const dx of [-s, s]) {
        if (this.isValidPosition(p.x + dx, p.y, p.id)) {
          p.x += dx;
          if (this.isValidPosition(p.x, p.y + stepY, p.id)) p.y += stepY;
          return dx;
        }
      }
    }
    return 0;
  }

  generateMap() {
    this.walls.clear(); this.blocks.clear();

    /* indestructible checkerboard walls */
    for (let gx = 1; gx < this.mapWidth / this.tileSize; gx += 2) {
      for (let gy = 1; gy < this.mapHeight / this.tileSize; gy += 2) {
        this.walls.add(`${gx},${gy}`);
      }
    }

    /* random destructible blocks */
    const W = this.mapWidth / this.tileSize;
    const H = this.mapHeight / this.tileSize;
    for (let gx = 0; gx < W; gx++) {
      for (let gy = 0; gy < H; gy++) {
        const key = `${gx},${gy}`;
        if (this.walls.has(key)) continue;

        const isNotSafe =
          (gx <= 2 && gy <= 2) ||                       // top‑left spawn
          (gx >= W - 3 && gy <= 2) ||                   // top‑right
          (gx <= 2 && gy >= H - 3) ||                   // bottom‑left
          (gx >= W - 3 && gy >= H - 3);                 // bottom‑right
        if (!isNotSafe && Math.random() < 0.30) this.blocks.add(key);
      }
    }
  }


  addPlayer(id, nickname, pos) {
    /* clear a block on the spawn tile (safety) */
    this.blocks.delete(`${Math.floor(pos.x / this.tileSize)},${Math.floor(pos.y / this.tileSize)}`);

    this.players.set(id, {
      id, nickname,
      x: pos.x, y: pos.y,
      dir: 'down',
      speed: 1,          // base speed
      speedLevel: 1, 
      slideSlowTicks: 0, // ← slow‑down timer
      lives: 3, bombs: 1, power: 1,
      maxBombs: 1, activeBombs: 0,
      alive: true
      
    });
  }
  removePlayer(id) { this.players.delete(id); }


  applyAction(pid, action) {
    const p = this.players.get(pid);
    if (!p || !p.alive) return;

    /* tick down any temporary slow */
    if (p.slideSlowTicks > 0) p.slideSlowTicks--;

    /* ---------- MOVE ---------- */
    if (action.type === 'move') {
      let { dx, dy } = action;
      const magX = Math.abs(dx), magY = Math.abs(dy);
      if (magX && magY) {
        if (magX >= magY) dy = 0; else dx = 0;
      }
      if (!dx && !dy) return;

      p.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy < 0 ? 'up' : 'down';

      const slowFactor = p.slideSlowTicks ? 0.5 : 1;    // slower while sliding
      const pixelN = Math.max(1, Math.floor(p.speed * 2 * slowFactor));
      const slideTol = Math.min(pixelN, 16);

      const stepX = Math.sign(dx);
      const stepY = Math.sign(dy);

      for (let i = 0; i < pixelN; i++) {
        let moved = false, slid = false;

        if (stepX) {
          const nx = p.x + stepX;
          if (this.isValidPosition(nx, p.y, p.id)) {
            p.x = nx; moved = true;
          } else {
            const sY = this.trySlideY(p, slideTol, stepX);
            slid = sY !== 0; moved = slid;
          }
        } else if (stepY) {
          const ny = p.y + stepY;
          if (this.isValidPosition(p.x, ny, p.id)) {
            p.y = ny; moved = true;
          } else {
            const sX = this.trySlideX(p, slideTol, stepY);
            slid = sX !== 0; moved = slid;
          }
        }

        if (slid) p.slideSlowTicks = 10;
        if (!moved) break;
      }

      this.checkPowerupCollection(p);
    }

    else if (action.type === 'placeBomb') {
      if (p.activeBombs >= p.maxBombs) return;

      const cx = p.x + this.playerSize / 2;
      const cy = p.y + this.playerSize / 2;
      const bx = Math.floor(cx / this.tileSize) * this.tileSize;
      const by = Math.floor(cy / this.tileSize) * this.tileSize;
      const key = `${bx},${by}`;

      if (!this.bombs.has(key)) {
        this.bombs.set(key, { x: bx, y: by, timer: 3000, power: p.power, owner: p.id });
        p.activeBombs++;
      }
    }
  }


  maybeSpawnPowerup(x, y) {
    if (Math.random() < 0.30) {
      const types = ['bombs', 'flames', 'speed'];
      this.powerups.set(`${x},${y}`, { x, y, type: types[Math.floor(Math.random() * types.length)] });
    }
  }

  checkPowerupCollection(p) {
    const cx = p.x + 16, cy = p.y + 16;
    for (const [id, pu] of Array.from(this.powerups.entries())) {
      const pcx = pu.x + 20, pcy = pu.y + 20;
      if (Math.abs(cx - pcx) < 20 && Math.abs(cy - pcy) < 20) {
        this.applyPowerup(p, pu.type);
        this.powerups.delete(id);
      }
    }
  }
  applyPowerup(p, type) {
    if (type === 'bombs') p.maxBombs++;
    else if (type === 'flames') p.power++;
    else if (type === 'speed')  { p.speed += 0.4;  p.speedLevel++;} // speed boost
  }


  tick(dt) {
    for (const [id, b] of Array.from(this.bombs.entries())) {
      b.timer -= dt;
      if (b.timer <= 0) this.explodeBomb(b, id);
    }
    for (const [id, ex] of Array.from(this.explosions.entries())) {
      ex.timer -= dt;
      if (ex.timer <= 0) this.explosions.delete(id);
    }
  }

  explodeBomb(bomb, key) {
    this.bombs.delete(key);
    const owner = this.players.get(bomb.owner);
    if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

    for (const pos of this.getExplosionArea(bomb.x, bomb.y, bomb.power)) {
      const id = `${pos.x},${pos.y}`;
      this.explosions.set(id, { ...pos, timer: 300 });

      const cell = `${pos.x / this.tileSize},${pos.y / this.tileSize}`;
      if (this.blocks.has(cell)) {
        this.blocks.delete(cell);
        this.maybeSpawnPowerup(pos.x, pos.y);
      }
      this.checkPlayerDamage(pos.x, pos.y);

      if (this.bombs.has(id)) this.explodeBomb(this.bombs.get(id), id); // chain
    }
  }

  getExplosionArea(x, y, power) {
    const res = [{ x, y }];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      for (let i = 1; i <= power; i++) {
        const nx = x + dx * i * this.tileSize;
        const ny = y + dy * i * this.tileSize;
        if (nx < 0 || ny < 0 || nx >= this.mapWidth || ny >= this.mapHeight) break;
        const cell = `${nx / this.tileSize},${ny / this.tileSize}`;
        if (this.walls.has(cell)) break;
        res.push({ x: nx, y: ny });
        if (this.blocks.has(cell)) break;
      }
    }
    return res;
  }

  checkPlayerDamage(exX, exY) {
    const eCx = exX + this.tileSize / 2, eCy = exY + this.tileSize / 2, r = this.tileSize / 2;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const pcx = p.x + this.playerSize / 2, pcy = p.y + this.playerSize / 2;
      if (Math.abs(pcx - eCx) < r && Math.abs(pcy - eCy) < r) {
        if (--p.lives <= 0) p.alive = false;
      }
    }
  }


  toJSON() {
    return {
      players: Array.from(this.players.values()),
      bombs: Array.from(this.bombs.values()),
      explosions: Array.from(this.explosions.values()),
      powerups: Array.from(this.powerups.values()),
      walls: Array.from(this.walls),
      blocks: Array.from(this.blocks),
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      tileSize: this.tileSize
    };
  }
}
export default GameState;
