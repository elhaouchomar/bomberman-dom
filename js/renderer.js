import { createVNode } from '../framework/core.js';

export function renderGame(state, playerId) {
    // Helper to render powerups
    const renderPowerups = () =>
        state.powerups.map(powerup =>
            createVNode('img', {
                class: `powerup ${powerup.type}`,
                src: powerup.type === 'bombs' ? 'images/bombGift.png'
                    : powerup.type === 'flames' ? 'images/flamGift.png'
                    : powerup.type === 'speed' ? 'images/speedGift.png'
                    : '',
                alt: `${powerup.type} Power-up`,
                title: `${powerup.type.charAt(0).toUpperCase() + powerup.type.slice(1)} Power-up`,
                style: `left: ${powerup.x + 5}px; top: ${powerup.y + 5}px; width: 30px; height: 30px; position: absolute; z-index: 6;`
            })
        );

    // Helper to render bombs
    const renderBombs = () =>
        state.bombs.map(bomb =>
            createVNode('img', {
                class: 'bomb',
                src: 'images/Bomb.png',
                alt: 'Bomb',
                style: `left: ${bomb.x + 4}px; top: ${bomb.y + 4}px; width: 32px; height: 32px; position: absolute; z-index: 5;`
            })
        );

    // Helper to render explosions
    const renderExplosions = () =>
        state.explosions.map(explosion =>
            createVNode('img', {
                class: 'explosion',
                src: 'images/Flames.png',
                alt: 'Explosion',
                style: `left: ${explosion.x}px; top: ${explosion.y}px; width: 40px; height: 40px; position: absolute; z-index: 8;`
            })
        );

    // Helper to render players
    const renderPlayers = () =>
        state.players.filter(p => p.alive).map(p =>
            createVNode('img', {
                class: `player ${p.id === playerId ? 'me' : ''}`,
                src: 'images/yuffiekisaragi.png',
                alt: p.nickname,
                title: p.nickname,
                style: `left: ${p.x}px; top: ${p.y}px; width: 32px; height: 32px; position: absolute; z-index: 10;`
            })
        );

    // Helper to render walls
    const renderWalls = () =>
        state.walls.map(key => {
            const [x, y] = key.split(',').map(Number);
            return createVNode('div', {
                class: 'wall',
                style: `left: ${x * state.tileSize}px; top: ${y * state.tileSize}px; position: absolute; z-index: 2; width: ${state.tileSize}px; height: ${state.tileSize}px;`
            });
        });

    // Helper to render blocks
    const renderBlocks = () =>
        state.blocks.map(key => {
            const [x, y] = key.split(',').map(Number);
            return createVNode('div', {
                class: 'block',
                style: `left: ${x * state.tileSize}px; top: ${y * state.tileSize}px; position: absolute; z-index: 3; width: ${state.tileSize}px; height: ${state.tileSize}px;`
            });
        });

    // UI for player stats (lives, bombs, power, speed)
    let me = playerId ? state.players.find(p => p.id === playerId) : null;
    const lives = me ? Array.from({ length: me.lives }, (_, i) =>
        createVNode('img', { src: 'images/heart.png', alt: 'Heart', key: `l${i}` })
    ) : [];
    const bombs = me ? Array.from({ length: me.maxBombs }, (_, i) =>
        createVNode('img', { src: 'images/Bomb.png', alt: 'Bomb', key: `b${i}` })
    ) : [];
    const power = me ? Array.from({ length: me.power }, (_, i) =>
        createVNode('img', { src: 'images/Flames.png', alt: 'Flame', key: `p${i}` })
    ) : [];
    const speed = me ? Array.from({ length: me.speed }, (_, i) =>
        createVNode('img', { src: 'images/speedGift.png', alt: 'Speed', key: `s${i}` })
    ) : [];

    return createVNode('div', { class: 'game-container' }, [
        createVNode('div', { class: 'game-ui' }, [
            createVNode('div', { id: 'player-info', class: 'player-info' }, [
                createVNode('div', {}, lives),
                createVNode('div', {}, bombs),
                createVNode('div', {}, power),
                createVNode('div', {}, speed)
            ])
        ]),
        createVNode('div', { id: 'game-map', class: 'game-map', style: 'position: relative;' }, [
            ...renderWalls(),
            ...renderBlocks(),
            ...renderPowerups(),
            ...renderBombs(),
            ...renderExplosions(),
            ...renderPlayers()
        ])
    ]);
}

// function getPlayerColor(id) {
//     // Assign color based on id (simple hash)
//     const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
//     const n = parseInt(id.replace(/\D/g, ''), 10) || 0;
//     return colors[n % colors.length];
// } 