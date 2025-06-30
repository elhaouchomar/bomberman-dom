export class MiniFramework {
    constructor() {
        this.components = new Map();
        this.eventHandlers = new Map();
        this.gameLoop = null;
        this.lastTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
    }

    createElement(tag, className, parent) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (parent) parent.appendChild(element);
        return element;
    }

    setStyle(element, styles) {
        Object.assign(element.style, styles);
    }

    on(element, event, handler) {
        element.addEventListener(event, handler);
        if (!this.eventHandlers.has(element)) {
            this.eventHandlers.set(element, new Map());
        }
        this.eventHandlers.get(element).set(event, handler);
    }

    off(element, event) {
        if (this.eventHandlers.has(element)) {
            const handler = this.eventHandlers.get(element).get(event);
            if (handler) {
                element.removeEventListener(event, handler);
                this.eventHandlers.get(element).delete(event);
            }
        }
    }

    startGameLoop(callback) {
        const loop = (currentTime) => {
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;

            // FPS calculation
            this.frameCount++;
            if (currentTime - this.fpsUpdateTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.fpsUpdateTime = currentTime;
            }

            callback(deltaTime);
            this.gameLoop = requestAnimationFrame(loop);
        };
        this.gameLoop = requestAnimationFrame(loop);
    }

    stopGameLoop() {
        if (this.gameLoop) {
            cancelAnimationFrame(this.gameLoop);
            this.gameLoop = null;
        }
    }

    getFPS() {
        return this.fps;
    }
} 