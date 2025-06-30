import { BombermanGame } from './game.js';

// Initialize the game
const game = new BombermanGame();

window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    alert('An unexpected error occurred. Please reload the page.');
});

// Performance monitoring
setInterval(() => {
    if (game.framework.getFPS() > 0) {
        console.log(`FPS: ${game.framework.getFPS()}`);
    }
}, 1000);

// Prevent context menu on right click
document.addEventListener('contextmenu', e => e.preventDefault());

// Prevent scrolling with arrow keys
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
}); 