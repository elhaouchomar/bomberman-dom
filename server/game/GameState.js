class GameState {
  constructor() {
    /* -------- config -------- */
    this.mapWidth  = 760;
    this.mapHeight = 600;
    this.tileSize  = 40;
    this.playerSize = 32;

    /* -------- state --------- */
    this.players    = new Map();   // id -> { ... }
    this.bombs      = new Map();   // "x,y" -> {x,y,timer,power,owner}
    this.explosions = new Map();   // "x,y" -> {x,y,timer}
    this.powerups   = new Map();   // "x,y" -> {x,y,type}
    this.walls      = new Set();   // "gx,gy"
    this.blocks     = new Set();   // "gx,gy"

    this.generateMap();
  }

  /* =====================================================================
     COLLISION
     ===================================================================== */
  isValidPosition(x, y) {
    const s = this.playerSize - 1;                     
    if (x < 0 || y < 0 || x + s >= this.mapWidth || y + s >= this.mapHeight) return false;
    const ok = (cx, cy) => {
      const key = `${Math.floor(cx / this.tileSize)},${Math.floor(cy / this.tileSize)}`;
      return !this.walls.has(key) && !this.blocks.has(key);
    };
    return ok(x, y) && ok(x + s, y) && ok(x, y + s) && ok(x + s, y + s);
  }

  trySlideY(p, tol, stepX) {
    for (let s = 1; s <= tol; s++) {
      for (const dy of [-s, s]) {
        if (this.isValidPosition(p.x, p.y + dy)) {
          p.y += dy;
          if (this.isValidPosition(p.x + stepX, p.y)) p.x += stepX;
          return true;
        }
      }
    }
    return false;
  }
  trySlideX(p, tol, stepY) {
    for (let s = 1; s <= tol; s++) {
      for (const dx of [-s, s]) {
        if (this.isValidPosition(p.x + dx, p.y)) {
          p.x += dx;
          if (this.isValidPosition(p.x, p.y + stepY)) p.y += stepY;
          return true;
        }
      }
    }
    return false;
  }

  generateMap() {
    this.walls.clear(); this.blocks.clear();

    for (let gx = 1; gx < this.mapWidth / this.tileSize; gx += 2) {
      for (let gy = 1; gy < this.mapHeight / this.tileSize; gy += 2) {
        this.walls.add(`${gx},${gy}`);
      }
    }

    const w = this.mapWidth / this.tileSize;
    const h = this.mapHeight / this.tileSize;
    for (let gx = 0; gx < w; gx++) {
      for (let gy = 0; gy < h; gy++) {
        const key = `${gx},${gy}`;
        if (this.walls.has(key)) continue;

        const safe =
          (gx <= 2 && gy <= 2) ||
          (gx >= w - 3 && gy <= 2) ||
          (gx <= 2 && gy >= h - 3) ||
          (gx >= w - 3 && gy >= h - 3);

        if (!safe && Math.random() < 0.30) this.blocks.add(key);
      }
    }
  }

  addPlayer(id, nickname, pos) {
    this.blocks.delete(`${Math.floor(pos.x/this.tileSize)},${Math.floor(pos.y/this.tileSize)}`);

    this.players.set(id, {
      id, nickname,
      x: pos.x, y: pos.y,
      dir: 'down',
      speed: 1,               
      lives: 3,
      bombs: 1,
      power: 1,
      maxBombs: 1,
      activeBombs: 0,
      alive: true
    });
  }
  removePlayer(id) { this.players.delete(id); }


  applyAction(pid, action) {
    const p = this.players.get(pid);
    if (!p || !p.alive) return;

    if (action.type === 'move') {
      let { dx, dy } = action;                  
      const magX = Math.abs(dx), magY = Math.abs(dy);
      if (magX && magY) {                       
        if (magX >= magY) dy = 0; else dx = 0;
      }
      if (!dx && !dy) return;

      p.dir = dx>0?'right': dx<0?'left': dy<0?'up':'down';

      const stepX   = Math.sign(dx);
      const stepY   = Math.sign(dy);
      const pixelN  = p.speed * 2;  
      const slideTol= Math.min(pixelN, 16);

      for (let i = 0; i < pixelN; i++) {
        let moved = false;
        if (stepX) {
          const nx = p.x + stepX;
          if (this.isValidPosition(nx, p.y)) { p.x = nx; moved = true; }
          else moved = this.trySlideY(p, slideTol, stepX);
        } else if (stepY) {
          const ny = p.y + stepY;
          if (this.isValidPosition(p.x, ny)) { p.y = ny; moved = true; }
          else moved = this.trySlideX(p, slideTol, stepY);
        }
        if (!moved) break;
      }

      this.checkPowerupCollection(p);
    }

    else if (action.type === 'placeBomb') {
      if (p.activeBombs >= p.maxBombs) return;
      const cx = p.x + this.playerSize/2;
      const cy = p.y + this.playerSize/2;
      const bx = Math.floor(cx/this.tileSize)*this.tileSize;
      const by = Math.floor(cy/this.tileSize)*this.tileSize;
      const key = `${bx},${by}`;
      if (!this.bombs.has(key)) {
        this.bombs.set(key,{x:bx,y:by,timer:3000,power:p.power,owner:p.id});
        p.activeBombs++;
      }
    }
  }

  maybeSpawnPowerup(x, y) {
    if (Math.random() < 0.30) {
      const types = ['bombs', 'flames', 'speed'];
      const t = types[Math.floor(Math.random() * types.length)];
      this.powerups.set(`${x},${y}`, { x, y, type: t });
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
    if (type === 'bombs')   p.maxBombs++;
    else if (type === 'flames') p.power++;
    else if (type === 'speed')  p.speed+=0.3;         
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

  explodeBomb(bomb, id) {
    this.bombs.delete(id);
    const owner = this.players.get(bomb.owner);
    if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

    for (const pos of this.getExplosionArea(bomb.x, bomb.y, bomb.power)) {
      const key = `${pos.x},${pos.y}`;
      this.explosions.set(key, { ...pos, timer: 300 });

      const cell = `${pos.x / this.tileSize},${pos.y / this.tileSize}`;
      if (this.blocks.has(cell)) {
        this.blocks.delete(cell);
        this.maybeSpawnPowerup(pos.x, pos.y);
      }

      this.checkPlayerDamage(pos.x, pos.y);

      if (this.bombs.has(key)) this.explodeBomb(this.bombs.get(key), key);
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
    const exCx = exX + this.tileSize/2, exCy = exY + this.tileSize/2, r = this.tileSize/2;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const pcx = p.x + this.playerSize/2, pcy = p.y + this.playerSize/2;
      if (Math.abs(pcx - exCx) < r && Math.abs(pcy - exCy) < r) {
        if (--p.lives <= 0) p.alive = false;
      }
    }
  }


  toJSON() {
    return {
      players   : Array.from(this.players.values()),
      bombs     : Array.from(this.bombs.values()),
      explosions: Array.from(this.explosions.values()),
      powerups  : Array.from(this.powerups.values()),
      walls     : Array.from(this.walls),
      blocks    : Array.from(this.blocks),
      mapWidth  : this.mapWidth,
      mapHeight : this.mapHeight,
      tileSize  : this.tileSize
    };
  }
}

export default GameState;
