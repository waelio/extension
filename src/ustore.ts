/**
 * @waelio/extension — uStore adapter for Chrome Extension storage
 *
 * Maps the uStore interface (get/set/has/remove) to chrome.storage APIs:
 *   localStorage   → chrome.storage.local
 *   sessionStorage → chrome.storage.session
 *   configStorage  → chrome.storage.sync (cross-device)
 *   memoryStorage  → in-memory Map
 *   signalStorage  → chrome.storage.local + chrome.storage.onChanged
 */

const NAMESPACE = "uStore";

type StorageValue = unknown;
type StorageArea = chrome.storage.StorageArea;
type ChangeListener = (value: StorageValue | null, change: {
  key: string;
  value: StorageValue | null;
  previousValue: StorageValue | null;
  source: "set" | "remove";
}) => void;

function namespacedKey(key: string): string {
  return `${NAMESPACE}:${key}`;
}

function createChromeAdapter(area: StorageArea, label: string) {
  return {
    async get(key: string): Promise<StorageValue | null> {
      try {
        const nsKey = namespacedKey(key);
        const result = await area.get(nsKey);
        return result[nsKey] ?? null;
      } catch (error) {
        console.error(`@waelio/extension ${label}.get failed:`, error);
        return null;
      }
    },

    async getItem(key: string): Promise<StorageValue | null> {
      return this.get(key);
    },

    async set(key: string, value: StorageValue): Promise<StorageValue | null> {
      try {
        const nsKey = namespacedKey(key);
        await area.set({ [nsKey]: value });
        return value;
      } catch (error) {
        console.error(`@waelio/extension ${label}.set failed:`, error);
        return null;
      }
    },

    async setItem(key: string, value: StorageValue): Promise<StorageValue | null> {
      return this.set(key, value);
    },

    async has(key: string): Promise<boolean> {
      try {
        const nsKey = namespacedKey(key);
        const result = await area.get(nsKey);
        return nsKey in result;
      } catch (error) {
        console.error(`@waelio/extension ${label}.has failed:`, error);
        return false;
      }
    },

    async hasItem(key: string): Promise<boolean> {
      return this.has(key);
    },

    async remove(key: string): Promise<boolean> {
      try {
        const nsKey = namespacedKey(key);
        await area.remove(nsKey);
        return true;
      } catch (error) {
        console.error(`@waelio/extension ${label}.remove failed:`, error);
        return false;
      }
    },

    async removeItem(key: string): Promise<boolean> {
      return this.remove(key);
    },

    async getAll(): Promise<Record<string, StorageValue>> {
      try {
        const all = await area.get(null);
        const prefix = `${NAMESPACE}:`;
        const result: Record<string, StorageValue> = {};
        for (const [k, v] of Object.entries(all)) {
          if (k.startsWith(prefix)) {
            result[k.slice(prefix.length)] = v;
          }
        }
        return result;
      } catch (error) {
        console.error(`@waelio/extension ${label}.getAll failed:`, error);
        return {};
      }
    },

    async clear(): Promise<boolean> {
      try {
        const all = await this.getAll();
        const keys = Object.keys(all).map(namespacedKey);
        if (keys.length > 0) {
          await area.remove(keys);
        }
        return true;
      } catch (error) {
        console.error(`@waelio/extension ${label}.clear failed:`, error);
        return false;
      }
    },
  };
}

// ── Memory Storage (in-memory, same as your memoryStorage) ──

function createMemoryStorage() {
  const state = new Map<string, StorageValue>();

  return {
    get(key: string): StorageValue | null {
      return state.get(key) ?? null;
    },
    getItem(key: string): StorageValue | null {
      return this.get(key);
    },
    set(key: string, value: StorageValue): StorageValue {
      state.set(key, value);
      return value;
    },
    setItem(key: string, value: StorageValue): StorageValue {
      return this.set(key, value);
    },
    has(key: string): boolean {
      return state.has(key);
    },
    hasItem(key: string): boolean {
      return this.has(key);
    },
    remove(key: string): boolean {
      return state.delete(key);
    },
    removeItem(key: string): boolean {
      return this.remove(key);
    },
    snapshot(): Record<string, StorageValue> {
      return Object.fromEntries(state);
    },
  };
}

// ── Signal Storage (reactive, cross-context via chrome.storage.onChanged) ──

function createSignalStorage(area: StorageArea) {
  const listeners = new Map<string, Set<ChangeListener>>();
  const adapter = createChromeAdapter(area, "signalStorage");

  // Listen for cross-context changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    const prefix = `${NAMESPACE}:`;
    for (const [fullKey, change] of Object.entries(changes)) {
      if (!fullKey.startsWith(prefix)) continue;

      const key = fullKey.slice(prefix.length);
      const keyListeners = listeners.get(key);
      if (!keyListeners || keyListeners.size === 0) continue;

      const source: "set" | "remove" = change.newValue === undefined ? "remove" : "set";
      const changeInfo = {
        key,
        value: change.newValue ?? null,
        previousValue: change.oldValue ?? null,
        source,
      };

      keyListeners.forEach((listener) => {
        try {
          listener(change.newValue ?? null, changeInfo);
        } catch (error) {
          console.error("@waelio/extension signalStorage listener error:", error);
        }
      });
    }
  });

  return {
    ...adapter,

    async set(key: string, value: StorageValue): Promise<StorageValue | null> {
      return adapter.set(key, value);
    },

    async remove(key: string): Promise<boolean> {
      return adapter.remove(key);
    },

    subscribe(key: string, listener: ChangeListener): () => boolean {
      if (!key || typeof listener !== "function") {
        return () => false;
      }

      const keyListeners = listeners.get(key) ?? new Set<ChangeListener>();
      keyListeners.add(listener);
      listeners.set(key, keyListeners);

      return () => {
        keyListeners.delete(listener);
        if (keyListeners.size === 0) {
          listeners.delete(key);
        }
        return true;
      };
    },
  };
}

// ── Cookie Storage (via chrome.cookies API) ──

function createCookieStorage() {
  return {
    async get(key: string, url = "https://waelio.com"): Promise<StorageValue | null> {
      try {
        const cookie = await chrome.cookies.get({ url, name: key });
        if (!cookie) return null;
        try {
          return JSON.parse(cookie.value);
        } catch {
          return cookie.value;
        }
      } catch (error) {
        console.error("@waelio/extension cookieStorage.get failed:", error);
        return null;
      }
    },

    async set(key: string, value: StorageValue, url = "https://waelio.com"): Promise<StorageValue | null> {
      try {
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        await chrome.cookies.set({ url, name: key, value: serialized, path: "/" });
        return value;
      } catch (error) {
        console.error("@waelio/extension cookieStorage.set failed:", error);
        return null;
      }
    },

    async remove(key: string, url = "https://waelio.com"): Promise<boolean> {
      try {
        await chrome.cookies.remove({ url, name: key });
        return true;
      } catch (error) {
        console.error("@waelio/extension cookieStorage.remove failed:", error);
        return false;
      }
    },

    async has(key: string, url = "https://waelio.com"): Promise<boolean> {
      const cookie = await this.get(key, url);
      return cookie !== null;
    },
  };
}

// ── Export the unified uStore ──

export const localStorage = createChromeAdapter(chrome.storage.local, "localStorage");
export const sessionStorage = createChromeAdapter(chrome.storage.session, "sessionStorage");
export const configStorage = createChromeAdapter(chrome.storage.sync, "configStorage");
export const memoryStorage = createMemoryStorage();
export const signalStorage = createSignalStorage(chrome.storage.local);
export const cookieStorage = createCookieStorage();

export const uStore = {
  local: localStorage,
  session: sessionStorage,
  config: configStorage,
  memory: memoryStorage,
  signal: signalStorage,
  cookie: cookieStorage,
};

export default uStore;
