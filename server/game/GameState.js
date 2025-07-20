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
    const playerCollisionSize = this.playerSize - 1;
    if (x < 0 || y < 0 || x + playerCollisionSize >= this.mapWidth || y + playerCollisionSize >= this.mapHeight) return false;

    const ok = (cx, cy) => {
      const key = `${Math.floor(cx / this.tileSize)},${Math.floor(cy / this.tileSize)}`;
      return !this.walls.has(key) && !this.blocks.has(key);
    };
    if (!ok(x, y) || !ok(x + playerCollisionSize, y) || !ok(x, y + playerCollisionSize) || !ok(x + playerCollisionSize, y + playerCollisionSize)) return false;

    for (const bomb of this.bombs.values()) {
      if (selfId && bomb.owner === selfId) continue;
      if (
        x + playerCollisionSize > bomb.x && x < bomb.x + this.tileSize &&
        y + playerCollisionSize > bomb.y && y < bomb.y + this.tileSize
      ) return false;
    }

    for (const otherPlayer of this.players.values()) {
      if (!otherPlayer.alive) continue;
      if (selfId && otherPlayer.id === selfId) continue;
      if (
        x + playerCollisionSize > otherPlayer.x && x < otherPlayer.x + this.playerSize &&
        y + playerCollisionSize > otherPlayer.y && y < otherPlayer.y + this.playerSize
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
      const pixelNumber = Math.max(1, Math.floor(p.speed * 1.5 * slowFactor));
      const maxSlideDistance = Math.min(pixelNumber, 16);

      const stepX = Math.sign(dx);
      const stepY = Math.sign(dy);

      for (let i = 0; i < pixelNumber; i++) {
        let moved = false, slid = false;

        if (stepX) {
          const newPosX = p.x + stepX;
          if (this.isValidPosition(newPosX, p.y, p.id)) {
            p.x = newPosX; moved = true;
          } else {
            const slideAmountY = this.trySlideY(p, maxSlideDistance, stepX);
            slid = slideAmountY !== 0; moved = slid;
          }
        } else if (stepY) {
          const newPosY = p.y + stepY;
          if (this.isValidPosition(p.x, newPosY, p.id)) {
            p.y = newPosY; moved = true;
          } else {
            const slideAmountX = this.trySlideX(p, maxSlideDistance, stepY);
            slid = slideAmountX !== 0; moved = slid;
          }
        }

        if (slid) p.slideSlowTicks = 10;
        if (!moved) break;
      }

      this.checkPowerupCollection(p);
    }

    else if (action.type === 'placeBomb') {
      if (p.activeBombs >= p.maxBombs) return;

      const playerCenterX = p.x + this.playerSize / 2;
      const playerCenterY = p.y + this.playerSize / 2;
      const bombTileX = Math.floor(playerCenterX / this.tileSize) * this.tileSize;
      const bombTileY = Math.floor(playerCenterY / this.tileSize) * this.tileSize;
      const bombKey = `${bombTileX},${bombTileY}`;

      if (!this.bombs.has(bombKey)) {
        this.bombs.set(bombKey, { x: bombTileX, y: bombTileY, timer: 3000, power: p.power, owner: p.id });
        p.activeBombs++;
      }
    }
  }


  createPowerup(x, y) {
    if (Math.random() < 0.30) {
      const types = ['bombs', 'flames', 'speed'];
      this.powerups.set(`${x},${y}`, { x, y, type: types[Math.floor(Math.random() * types.length)] });
    }
  }

  checkPowerupCollection(p) {
    const playerCenterX = p.x + 16, playerCenterY = p.y + 16;
    for (const [id, powerup] of Array.from(this.powerups.entries())) {
      const powerupCenterX = powerup.x + 20, powerupCenterY = powerup.y + 20;
      if (Math.abs(playerCenterX - powerupCenterX) < 20 && Math.abs(playerCenterY - powerupCenterY) < 20) {
        this.applyPowerup(p, powerup.type);
        this.powerups.delete(id);
      }
    }
  }
  applyPowerup(p, type) {
    if (type === 'bombs') p.maxBombs++;
    else if (type === 'flames') p.power++;
    else if (type === 'speed')  { p.speed += 0.4;  p.speedLevel++;} // speed boost
  }


  updateTimers(dt) {
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
        this.createPowerup(pos.x, pos.y);
      }
      this.checkPlayerDamage(pos.x, pos.y);

      if (this.bombs.has(id)) this.explodeBomb(this.bombs.get(id), id); // chain
    }
  }

  getExplosionArea(x, y, power) {
    const res = [{ x, y }];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dirX, dirY] of dirs) {
      for (let i = 1; i <= power; i++) {
        const newPosX = x + dirX * i * this.tileSize;
        const newPosY = y + dirY * i * this.tileSize;
        if (newPosX < 0 || newPosY < 0 || newPosX >= this.mapWidth || newPosY >= this.mapHeight) break;
        const cell = `${newPosX / this.tileSize},${newPosY / this.tileSize}`;
        if (this.walls.has(cell)) break;
        res.push({ x: newPosX, y: newPosY });
        if (this.blocks.has(cell)) break;
      }
    }
    return res;
  }

  checkPlayerDamage(explosionX, explosionY) {
    const explosionCenterX = explosionX + this.tileSize / 2, explosionCenterY = explosionY + this.tileSize / 2, explosionRadius = this.tileSize / 2;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const playerCenterX = p.x + this.playerSize / 2, playerCenterY = p.y + this.playerSize / 2;
      if (Math.abs(playerCenterX - explosionCenterX) < explosionRadius && Math.abs(playerCenterY - explosionCenterY) < explosionRadius) {
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
