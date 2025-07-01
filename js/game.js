/**********************************************************************
 * Bomberman DOM – Game Logic  (no AI, no mini-map)
 *********************************************************************/

import { MiniFramework }   from './framework.js';
import { WebSocketClient } from './websocket.js';
import { GameState }       from './gameState.js';

export class BombermanGame {
  constructor() {
    this.framework  = new MiniFramework();
    this.websocket  = new WebSocketClient();
    this.gameState  = new GameState();

    this.nickname   = '';
    this.playerId   = 'player1';
    this.playerIdSet= false;
    this.currentList= [];         

    this.waitingTimer   = null;
    this.countdownTimer = null;

    this.keys            = {};
    this.moveInterval    = 50;
    this.lastMoveTime    = 0;
    this.controlsEnabled = true;

    this.gameStarted  = false;

    this.elements = new Map();
    this.init();
  }

  /* ───────────────── Bootstrap ───────────────── */
  init() { this.cacheDOMElements(); this.setupEvents(); this.setupWebSocket(); }

  cacheDOMElements() {
    [
      'nickname-screen','waiting-screen','game-screen',
      'join-btn','nickname-input','player-counter','countdown',
      'chat-messages','chat-input','chat-send',
      'game-map','lives','bombs','power','speed'
    ].forEach(id => this.elements.set(id, document.getElementById(id)));
  }

  /* ───────────────── DOM events ───────────────── */
  setupEvents() {
    const $ = id=>this.elements.get(id);
    this.framework.on($('join-btn'),'click',()=>this.joinGame());
    this.framework.on($('nickname-input'),'keydown',e=>e.key==='Enter'&&this.joinGame());

    const chatInp=$('chat-input');
    this.framework.on($('chat-send'),'click',e=>{e.stopPropagation();this.sendChat();});
    this.framework.on(chatInp,'keydown',e=>{if(e.key==='Enter'){e.stopPropagation();this.sendChat();}});

    this.framework.on(document,'keydown',e=>{
      if(e.target===chatInp) return;
      this.keys[e.key]=true;
      if(e.key===' '){e.preventDefault();this.placeBomb();}
    });
    this.framework.on(document,'keyup',e=>this.keys[e.key]=false);
  }

  /* ───────────────── WebSocket ───────────────── */
  setupWebSocket() {
    this.websocket.on('playerJoined',d=>{
      if(d.nickname===this.nickname&&!this.playerIdSet){this.playerId=d.id;this.playerIdSet=true;}
      this.addChat('System',`${d.nickname} joined`);
    });
    this.websocket.on('playerLeft',d=>this.addChat('System',`${d.nickname} left`));
    this.websocket.on('chatMessage',d=>this.addChat(d.nickname,d.message));

    this.websocket.on('playerList',list=>{
      this.currentList=list; this.playerCount=list.length;
      this.updateCounter();
      if(this.playerCount>=4) this.startCountdown();
      else if(this.playerCount>=2){
        if(!this.waitingTimer&&!this.countdownTimer)
          this.waitingTimer=setTimeout(()=>this.startCountdown(),20000);
      } else {
        clearTimeout(this.waitingTimer); this.waitingTimer=null;
        clearTimeout(this.countdownTimer);this.countdownTimer=null;
        this.elements.get('countdown').textContent='';
      }
    });

    this.websocket.on('move',d=>d.id!==this.playerId&&this.syncMove(d));
    this.websocket.on('placeBomb',d=>d.id!==this.playerId&&this.placeBombAt(d.id,d.x,d.y));
    this.websocket.on('gameStart',()=>this.startGame());
  }

  syncMove({id,x,y}){const p=this.gameState.players.get(id); if(p){p.x=x;p.y=y;this.updatePlayerPos(p);}}

  /* ───────────────── Lobby helpers ───────────────── */
  joinGame(){
    const n=this.elements.get('nickname-input').value.trim();
    if(!n) return alert('please enter nickname');
    this.nickname=n; this.showScreen('waiting-screen'); this.websocket.connect(n);
  }
  showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id)?.classList.add('active');}
  updateCounter(){this.elements.get('player-counter').textContent=`Players: ${this.playerCount}/4`; }
  startCountdown(){
    if(this.countdownTimer) return; clearTimeout(this.waitingTimer);
    let n=10; const c=this.elements.get('countdown');
    const tick=()=>{c.textContent=`Game starts in: ${n}`;if(n--<=0)this.websocket.send('gameStart',{});else this.countdownTimer=setTimeout(tick,1000);};tick();
  }

  addChat(who,msg){const box=this.elements.get('chat-messages');const d=this.framework.createElement('div');d.innerHTML=`<strong>${who}:</strong> ${msg}`;box.appendChild(d);box.scrollTop=box.scrollHeight;}
  sendChat(){const inp=this.elements.get('chat-input');const m=inp.value.trim();if(!m)return;this.websocket.send('chatMessage',{nickname:this.nickname,message:m});inp.value='';}

  /* ───────────────── Game start ───────────────── */
  startGame(){
    if(this.gameStarted) return; this.gameStarted=true;
    this.showScreen('game-screen'); this.controlsEnabled=true;
    this.gameState.generateMap();
    this.spawnPlayers(); this.drawMap();
    this.framework.startGameLoop(dt=>this.loop(dt));
  }

  spawnPlayers(){
    const corners=[{x:4,y:4},{x:this.gameState.mapWidth-36,y:4},{x:4,y:this.gameState.mapHeight-36},{x:this.gameState.mapWidth-36,y:this.gameState.mapHeight-36}];
    this.currentList.slice(0,4).forEach((pl,i)=>this.gameState.addPlayer(pl.id,pl.nickname,corners[i]));
    this.gameState.currentPlayer=this.gameState.players.get(this.playerId);
  }

  /* ───────── rendering ───────── */
  drawMap(){
    const map=this.elements.get('game-map'); map.innerHTML='';
    this.gameState.walls.forEach(k=>{const[x,y]=k.split(',').map(Number);const d=this.framework.createElement('div','wall',map);this.framework.setStyle(d,{left:`${x*40}px`,top:`${y*40}px`});});
    this.gameState.blocks.forEach(k=>{const[x,y]=k.split(',').map(Number);const d=this.framework.createElement('div','block',map);this.framework.setStyle(d,{left:`${x*40}px`,top:`${y*40}px`});});
    this.gameState.players.forEach(p=>{const d=this.framework.createElement('div',`player ${p.id}`,map);d.id=p.id;this.framework.setStyle(d,{left:`${p.x}px`,top:`${p.y}px`});});
  }

  /* ───────── main loop ───────── */
  loop(dt){
    this.handleInput();
    this.updateBombs(dt);
    this.updateExplosions(dt);
    this.updateUI();
    this.checkGameOver();
  }

  /* ───────── movement ───────── */
  handleInput(){
    if(!this.controlsEnabled) return;
    const p=this.gameState.currentPlayer; if(!p||!p.alive) return;
    const now=Date.now(); if(now-this.lastMoveTime<this.moveInterval) return;

    const s=p.speed*2; let nx=p.x, ny=p.y;
    if(this.keys['ArrowUp']||this.keys['w']) ny-=s;
    if(this.keys['ArrowDown']||this.keys['s']) ny+=s;
    if(this.keys['ArrowLeft']||this.keys['a']) nx-=s;
    if(this.keys['ArrowRight']||this.keys['d']) nx+=s;

    if(this.gameState.isValidPosition(nx,ny)){
      p.x=nx; p.y=ny; this.updatePlayerPos(p);
      this.lastMoveTime=now;
      this.websocket.send('move',{id:p.id,x:p.x,y:p.y});
    }
  }
  updatePlayerPos(p){const el=document.getElementById(p.id); if(el)this.framework.setStyle(el,{left:`${p.x}px`,top:`${p.y}px`});}

  /* ───────── bombs ───────── */
  placeBomb(){
    if(!this.controlsEnabled) return;
    const p=this.gameState.currentPlayer;
    if(!p||!p.alive||p.activeBombs>=p.maxBombs) return;
    const bx=Math.floor((p.x+16)/40)*40, by=Math.floor((p.y+16)/40)*40;
    this.placeBombAt(p.id,bx,by); this.websocket.send('placeBomb',{id:p.id,x:bx,y:by});
  }
  placeBombAt(owner,x,y){
    const p=this.gameState.players.get(owner); if(!p||!p.alive||p.activeBombs>=p.maxBombs) return;
    const id=`${x},${y}`; if(this.gameState.bombs.has(id)) return;
    this.gameState.bombs.set(id,{x,y,timer:3000,power:p.power,owner}); p.activeBombs++;
    const d=this.framework.createElement('div','bomb',this.elements.get('game-map')); d.id=`bomb-${id}`; this.framework.setStyle(d,{left:`${x+4}px`,top:`${y+4}px`});
  }
  updateBombs(dt){this.gameState.bombs.forEach((b,id)=>{if((b.timer-=dt)<=0)this.explodeBomb(b,id);});}
  explodeBomb(b,id){
    this.gameState.bombs.delete(id); const o=this.gameState.players.get(b.owner); if(o)o.activeBombs--;
    document.getElementById(`bomb-${id}`)?.remove();
    this.getExplosionArea(b.x,b.y,b.power).forEach(pos=>{
      const eId=`${pos.x},${pos.y}`;this.gameState.explosions.set(eId,{...pos,timer:300});
      const ex=this.framework.createElement('div','explosion',this.elements.get('game-map')); ex.id=`explosion-${eId}`; this.framework.setStyle(ex,{left:`${pos.x}px`,top:`${pos.y}px`});
      const cell=`${pos.x/40},${pos.y/40}`; if(this.gameState.blocks.has(cell)){this.gameState.blocks.delete(cell);document.querySelector(`.block[style*="left: ${pos.x}px"][style*="top: ${pos.y}px"]`)?.remove();}
      this.checkPlayerDamage(pos.x,pos.y);
    });
  }
  getExplosionArea(x,y,pwr){
    const arr=[{x,y}],dirs=[[0,-40],[0,40],[-40,0],[40,0]];
    dirs.forEach(([dx,dy])=>{
      for(let i=1;i<=pwr;i++){
        const nx=x+dx*i, ny=y+dy*i;
        if(nx<0||ny<0||nx>=this.gameState.mapWidth||ny>=this.gameState.mapHeight) break;
        const cell=`${nx/40},${ny/40}`; if(this.gameState.walls.has(cell)) break;
        arr.push({x:nx,y:ny}); if(this.gameState.blocks.has(cell)) break;
      }
    }); return arr;
  }
  updateExplosions(dt){this.gameState.explosions.forEach((e,id)=>{if((e.timer-=dt)<=0){this.gameState.explosions.delete(id);document.getElementById(`explosion-${id}`)?.remove();}});}

  /* ───────── Damage ───────── */
  checkPlayerDamage(x,y){
    this.gameState.players.forEach(p=>{
      if(!p.alive) return;
      const cx=p.x+16, cy=p.y+16;
      if(Math.abs(cx-(x+20))<20 && Math.abs(cy-(y+20))<20){
        if(--p.lives<=0){p.alive=false;document.getElementById(p.id)?.remove();}
        if(p.id===this.playerId) this.elements.get('lives').textContent=p.lives;
      }
    });
  }

  /* ───────── UI / Power-ups ───────── */
  updateUI(){
    const p=this.gameState.currentPlayer;
    if(!p) return;
    this.elements.get('lives').textContent=p.lives;
    this.elements.get('bombs').textContent=p.maxBombs;
    this.elements.get('power').textContent=p.power;
    this.elements.get('speed').textContent=p.speed;
  }

  /* ───────── Game-over ───────── */
  checkGameOver(){
    const alive=this.gameState.getAlivePlayers();
    if(alive.length>1 || this.gameState.gameOver) return;
    this.gameState.gameOver=true; this.controlsEnabled=false; this.framework.stopGameLoop();
    const map=this.elements.get('game-map');
    const box=this.framework.createElement('div','game-over',map);
    const msg=alive.length===1
      ? (alive[0].id===this.playerId ? '🎉 YOU WIN! 🎉' : `🏆 ${alive[0].nickname} WINS! 🏆`)
      : '💀 GAME OVER 💀<br>No survivors!';
    box.innerHTML=`<h2>${msg}</h2><button class="btn" onclick="location.reload()">Play Again</button>`;
  }
}
