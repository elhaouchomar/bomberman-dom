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
        const d = framework.createElement('div', `powerup ${powerup.type}`, map);
        framework.setStyle(d, {
            left: `${powerup.x + 5}px`,
            top: `${powerup.y + 5}px`
        });
        d.title = `${powerup.type.charAt(0).toUpperCase() + powerup.type.slice(1)} Power-up`;
    });

    // Draw bombs
    state.bombs.forEach(bomb => {
        const d = framework.createElement('div', 'bomb', map);
        framework.setStyle(d, {
            left: `${bomb.x + 4}px`,
            top: `${bomb.y + 4}px`
        });
    });

    // Draw explosions
    state.explosions.forEach(explosion => {
        const d = framework.createElement('div', 'explosion', map);
        framework.setStyle(d, {
            left: `${explosion.x}px`,
            top: `${explosion.y}px`
        });
    });

    // Draw players
    state.players.forEach(p => {
        if (!p.alive) return;
        const d = framework.createElement('div', `player ${p.id === playerId ? 'me' : ''}`, map);
        framework.setStyle(d, {
            left: `${p.x}px`,
            top: `${p.y}px`,
            background: getPlayerColor(p.id)
        });
        d.title = p.nickname;
    });

    // Update UI (lives, bombs, power, speed)
    if (playerId) {
        const me = state.players.find(p => p.id === playerId);
        if (me) {
            document.getElementById('lives').textContent = me.lives;
            document.getElementById('bombs').textContent = me.maxBombs;
            document.getElementById('power').textContent = me.power;
            document.getElementById('speed').textContent = me.speed;
        }
    }
}

function getPlayerColor(id) {
    // Assign color based on id (simple hash)
    const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
    const n = parseInt(id.replace(/\D/g, ''), 10) || 0;
    return colors[n % colors.length];
} 