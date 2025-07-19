import { createVNode } from '../framework/core.js';

export function renderGame(state, playerId) {
    if (!state || !playerId) return;
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
    const renderBorderWalls = () => {
        const t = state.tileSize;
        const w = state.mapWidth / t;
        const h = state.mapHeight / t;
        const nodes = [];

        for (let x = -1; x <= w; x++) {
            const left = x * t;
            nodes.push(createVNode('img', {
                class: 'wall border-wall',
                src: 'images/wall.png',
                style: `position:absolute; left:${left}px; top:${-t}px; width:${t}px; height:${t}px; z-index:2;`
            }));
            nodes.push(createVNode('img', {
                class: 'wall border-wall',
                src: 'images/wall.png',
                style: `position:absolute; left:${left}px; top:${h * t}px; width:${t}px; height:${t}px; z-index:2;`
            }));
        }

        for (let y = 0; y < h; y++) {
            const top = y * t;
            nodes.push(createVNode('img', {
                class: 'wall border-wall',
                src: 'images/wall.png',
                style: `position:absolute; left:${-t}px; top:${top}px; width:${t}px; height:${t}px; z-index:2;`
            }));
            nodes.push(createVNode('img', {
                class: 'wall border-wall',
                src: 'images/wall.png',
                style: `position:absolute; left:${w * t}px; top:${top}px; width:${t}px; height:${t}px; z-index:2;`
            }));
        }
        return nodes;
    };


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


    const hueCache = new Map();

    function getHueForPlayer(id, idx) {
        if (hueCache.has(id)) return hueCache.get(id);

        const base = [0, 130, 250, 50];
        let hue = base[idx % base.length]
        if (idx >= base.length) {
            hue = (idx * 80) % 360;
        }
        hueCache.set(id, hue);
        return hue;
    }

    // Helper to render players
    const renderPlayers = () => {
        const TILE = state.tileSize || 32;
        const SCALE = 1.25;
        const OFFSET = (TILE * SCALE - TILE) / 2;

        return state.players.filter(p => p.alive).map((p, idx) => {
            const hue = getHueForPlayer(p.id, idx);
            return createVNode('div', {
                class: `Character ${p.id === playerId ? 'me' : ''}`,
                style: `
        position:absolute;
        left:0; top:0;
        transform:translate(${p.x - OFFSET}px, ${p.y - OFFSET}px) scale(${SCALE});
        transform-origin:top left;
        width:${TILE}px; height:${TILE}px;
        --hue:${hue}deg;
        pointer-events:none;
        z-index:10;
      `
            }, [
                createVNode('img', {
                    class: 'Character_shadow pixelart',
                    src: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/21542/DemoRpgCharacterShadow.png'
                }),
                createVNode('img', {
                    class: `Character_spritesheet pixelart face-${p.dir || 'down'}`,
                    src: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/21542/DemoRpgCharacter.png',
                    alt: p.nickname, title: p.nickname
                })
            ]);
        });
    };



    // Helper to render walls
    const renderWalls = () =>
        state.walls.map(key => {
            const [x, y] = key.split(',').map(Number);
            return createVNode('img', {
                class: 'wall',
                src: 'images/wall.png',
                style: `
        left: ${x * state.tileSize}px;
        top: ${y * state.tileSize}px;
        position: absolute;
        z-index: 2;
        width: ${state.tileSize}px;
        height: ${state.tileSize}px;
      `
            });
        });

    const renderBlocks = () =>
        state.blocks.map(key => {
            const [x, y] = key.split(',').map(Number);
            return createVNode('img', {
                class: 'block',
                src: 'images/block.png',
                style: `
        left: ${x * state.tileSize}px;
        top: ${y * state.tileSize}px;
        position: absolute;
        z-index: 3;
        width: ${state.tileSize}px;
        height: ${state.tileSize}px;
      `
            });
        });

    // UI for player stats (lives, bombs, power, speed)
    let me = playerId ? state.players.find(p => p.id === playerId) : {};
    const lives = me ? Array.from({ length: me.lives }, (_, i) =>
        createVNode('img', { src: 'images/heart.png', alt: 'Heart', key: `l${i}` })
    ) : [];
    const bombs = me ? Array.from({ length: me.maxBombs }, (_, i) =>
        createVNode('img', { src: 'images/Bomb.png', alt: 'Bomb', key: `b${i}` })
    ) : [];
    const power = me ? Array.from({ length: me.power }, (_, i) =>
        createVNode('img', { src: 'images/Flames.png', alt: 'Flame', key: `p${i}` })
    ) : [];
    console.log("mpoweeeeeeeeeeere", power);
    const speed = me ? Array.from({ length: me.speed }, (_, i) =>
        createVNode('img', { src: 'images/speedGift.png', alt: 'Speed', key: `s${i}` })
    ) : [];
console.log("sppeeeeeed", speed);

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
            ...renderBorderWalls(),
            ...renderWalls(),
            ...renderBlocks(),
            ...renderPowerups(),
            ...renderBombs(),
            ...renderExplosions(),
            ...renderPlayers()
        ])
    ]);
}
