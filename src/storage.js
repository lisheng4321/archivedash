// src/storage.js
// Browser shim for window.storage — mimics the Claude artifact storage API
// using localStorage. Same get/set/delete/list signatures, so the dashboard
// component works unchanged.
//
// Data is namespaced under "archivedash:" so it won't collide with other apps
// on the same origin.

const KEY_PREFIX = "archivedash:";

const storageShim = {
  get: async (key) => {
    try {
      const v = localStorage.getItem(KEY_PREFIX + key);
      return v !== null ? { key, value: v, shared: false } : null;
    } catch (e) {
      console.error("[storage.get]", e);
      return null;
    }
  },

  set: async (key, value) => {
    try {
      localStorage.setItem(KEY_PREFIX + key, value);
      return { key, value, shared: false };
    } catch (e) {
      // Quota exceeded is the most common failure mode (5–10MB cap)
      console.error("[storage.set]", e);
      return null;
    }
  },

  delete: async (key) => {
    try {
      localStorage.removeItem(KEY_PREFIX + key);
      return { key, deleted: true, shared: false };
    } catch (e) {
      console.error("[storage.delete]", e);
      return null;
    }
  },

  list: async (prefix = "") => {
    try {
      const keys = [];
      const fullPrefix = KEY_PREFIX + prefix;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) {
          keys.push(k.slice(KEY_PREFIX.length));
        }
      }
      return { keys, prefix, shared: false };
    } catch (e) {
      console.error("[storage.list]", e);
      return { keys: [], prefix, shared: false };
    }
  },
};

// Install on window so the dashboard component can use window.storage.* directly
if (typeof window !== "undefined" && !window.storage) {
  window.storage = storageShim;
}

export default storageShim;
