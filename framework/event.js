export class EventManager {
  constructor() {
    this.handlers = new Map(); // elementId ➜ Map(eventType ➜ handler)
  }

 // public helper
  on(el, type, fn) {
    if (!el || !type || !fn) return;
    el["on" + type] = fn
  }

  cleanupElement(el) { // called by the VDOM diff on removal
    if (el?._eventId) {
      this.handlers.delete(el._eventId);
      delete el._eventId;
    }
  }
}

export const events = new EventManager();