/**
 * @waelio/extension — config adapter for Chrome Extension
 *
 * Maps BaseConfig to chrome.storage.sync for cross-device config.
 * Supports nested keys with ":" separator (e.g., "client:api:url").
 */

import { configStorage } from "./ustore.js";

type ConfigRecord = Record<string, unknown>;

function isConfigRecord(value: unknown): value is ConfigRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const DEFAULTS: ConfigRecord = {
  theme: "dim",
  notifications: true,
  sidePanel: true,
  autoRefresh: true,
  refreshInterval: 300000, // 5 minutes
  packages: [
    "@waelio/utils",
    "waelio-utils",
    "@waelio/ustore",
    "@waelio/cli",
    "@waelio/data",
    "@waelio/agent",
    "@waelio/messaging",
    "@waelio/sync",
    "quasar-app-extension-waelio",
  ],
};

class ExtensionConfig {
  private cache: ConfigRecord = { ...DEFAULTS };
  private loaded = false;

  async load(): Promise<ConfigRecord> {
    try {
      const stored = await configStorage.getAll();
      this.cache = { ...DEFAULTS, ...stored };
      this.loaded = true;
    } catch (error) {
      console.error("@waelio/extension config.load failed:", error);
      this.cache = { ...DEFAULTS };
    }
    return this.cache;
  }

  async set(key: string, value: unknown): Promise<unknown> {
    if (!this.loaded) await this.load();

    if (key.includes(":")) {
      const keys = key.split(":");
      let target: ConfigRecord = this.cache;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!isConfigRecord(target[keys[i]])) {
          target[keys[i]] = {};
        }
        target = target[keys[i]] as ConfigRecord;
      }
      target[keys[keys.length - 1]] = value;
    } else {
      this.cache[key] = value;
    }

    await configStorage.set(key, value);
    return value;
  }

  async get(key: string): Promise<unknown> {
    if (!this.loaded) await this.load();

    if (key.includes(":")) {
      return key.split(":").reduce<unknown>(
        (obj, segment) => isConfigRecord(obj) ? obj[segment] : undefined,
        this.cache,
      );
    }

    return this.cache[key];
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined && value !== null;
  }

  async getAll(): Promise<ConfigRecord> {
    if (!this.loaded) await this.load();
    return { ...this.cache };
  }

  async reset(): Promise<ConfigRecord> {
    this.cache = { ...DEFAULTS };
    await configStorage.clear();
    for (const [key, value] of Object.entries(DEFAULTS)) {
      await configStorage.set(key, value);
    }
    return this.cache;
  }
}

export const config = new ExtensionConfig();
export const conf = config;
export default config;
