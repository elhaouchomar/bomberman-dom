export function renderGame(state, playerId, framework) {
    // Get main game map element
    const map = document.getElementById('game-map');
    if (!map) return;
    map.innerHTML = '';

    // Draw walls
    state.walls.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const d = framework.createElement('div', 'wall', map);
        framework.setStyle(d, {
            left: `${x * state.tileSize}px`,
            top: `${y * state.tileSize}px`
        });
    });

    // Draw blocks
    state.blocks.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const d = framework.createElement('div', 'block', map);
        framework.setStyle(d, {
            left: `${x * state.tileSize}px`,
            top: `${y * state.tileSize}px`
        });
    });

    // Draw powerups
    state.powerups.forEach(powerup => {
        const d = framework.createElement('img', `powerup ${powerup.type}`, map);
        
        // Set image based on powerup type
        if (powerup.type === 'bombs') {
            d.src = 'images/bombGift.png';
        } else if (powerup.type === 'flames') {
            d.src = 'images/flamGift.png';
        } else if (powerup.type === 'speed') {
            d.src = 'images/speedGift.png';
        }
        
        d.alt = `${powerup.type} Power-up`;
        framework.setStyle(d, {
            left: `${powerup.x + 5}px`,
            top: `${powerup.y + 5}px`,
            width: '30px',
            height: '30px',
            position: 'absolute',
            zIndex: '6'
        });
        d.title = `${powerup.type.charAt(0).toUpperCase() + powerup.type.slice(1)} Power-up`;
    });

    // Draw bombs
    state.bombs.forEach(bomb => {
        const d = framework.createElement('img', 'bomb', map);
        d.src = 'images/Bomb.png';
        d.alt = 'Bomb';
        framework.setStyle(d, {
            left: `${bomb.x + 4}px`,
            top: `${bomb.y + 4}px`,
            width: '32px',
            height: '32px',
            position: 'absolute',
            zIndex: '5'
        });
    });

    // Draw explosions
    state.explosions.forEach(explosion => {
        const d = framework.createElement('img', 'explosion', map);
        d.src = 'images/Flames.png';
        d.alt = 'Explosion';
        framework.setStyle(d, {
            left: `${explosion.x}px`,
            top: `${explosion.y}px`,
            width: '40px',
            height: '40px',
            position: 'absolute',
            zIndex: '8'
        });
    });

    // Draw players
    state.players.forEach(p => {
        if (!p.alive) return;
        const d = framework.createElement('img', `player ${p.id === playerId ? 'me' : ''}`, map);
        d.src = 'images/yuffiekisaragi.png';
        d.alt = p.nickname;
        framework.setStyle(d, {
            left: `${p.x}px`,
            top: `${p.y}px`,
            width: '32px',
            height: '32px',
            position: 'absolute',
            zIndex: '10'
        });
        d.title = p.nickname;
    });

    // Update UI (lives, bombs, power, speed)
    if (playerId) {
        const me = state.players.find(p => p.id === playerId);
        if (me) {
            // Update lives with heart images
            const livesElement = document.getElementById('lives');
            if (livesElement) {
                livesElement.innerHTML = '';
                for (let i = 0; i < me.lives; i++) {
                    const heart = document.createElement('img');
                    heart.src = 'images/heart.png';
                    heart.alt = 'Heart';
                    // heart.style.width = '20px';
                    // heart.style.height = '20px';
                    // heart.style.marginRight = '2px';
                    livesElement.appendChild(heart);
                }
            }
            
            // Update bombs with bomb images
            const bombsElement = document.getElementById('bombs');
            if (bombsElement) {
                bombsElement.innerHTML = '';
                for (let i = 0; i < me.maxBombs; i++) {
                    const bomb = document.createElement('img');
                    bomb.src = 'images/Bomb.png';
                    bomb.alt = 'Bomb';
                    bombsElement.appendChild(bomb);
                }
            }
            
            // Update power with flame images
            const powerElement = document.getElementById('power');
            if (powerElement) {
                powerElement.innerHTML = '';
                for (let i = 0; i < me.power; i++) {
                    const flame = document.createElement('img');
                    flame.src = 'images/Flames.png';
                    flame.alt = 'Flame';
                    powerElement.appendChild(flame);
                }
            }
            
            // Update speed with speed images
            const speedElement = document.getElementById('speed');
            if (speedElement) {
                speedElement.innerHTML = '';
                for (let i = 0; i < me.speed; i++) {
                    const speed = document.createElement('img');
                    speed.src = 'images/speedGift.png';
                    speed.alt = 'Speed';
                    speedElement.appendChild(speed);
                }
            }
        }
    }
}

function getPlayerColor(id) {
    // Assign color based on id (simple hash)
    const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
    const n = parseInt(id.replace(/\D/g, ''), 10) || 0;
    return colors[n % colors.length];
} 