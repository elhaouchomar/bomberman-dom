let state = {};

/* subscriber list */
let subscribers = [];

export const store = {
  getState() {
    return { ...state };
  },

  setState(partial) {
    state = { ...state, ...partial };   // simple, generic merge
    subscribers.forEach(fn => fn());    // notify after every commit
  },

  /* subscribe returns an "unsubscribe" function */
  subscribe(fn) {
    subscribers.push(fn);
    return () => {
      subscribers = subscribers.filter(sub => sub !== fn);
    };
  },

  /* (optional) completely replace state – handy for tests or reset */
  reset(newState = {}) {
    state = { ...newState };
    subscribers.forEach(fn => fn());
  }
};