/**
 * @waelio/extension — Service Worker (background script)
 *
 * Handles: context menus, alarms, message routing, extension lifecycle.
 */

import { note } from "./note.js";
import { config } from "./config.js";
import { uStore } from "./ustore.js";
import { to } from "./utils.js";

// ── Context Menus ──

chrome.runtime.onInstalled.addListener(async () => {
  await config.load();

  chrome.contextMenus.create({
    id: "waelio-store-selection",
    title: "Store selection in uStore",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "waelio-copy-as-base64",
    title: "Copy as Base64",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "waelio-open-docs",
    title: "Open Waelio Docs",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: "waelio-view-storage",
    title: "View uStore Contents",
    contexts: ["action"],
  });

  note.log("Waelio Toolkit installed");
});

// ── Context Menu Handlers ──

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "waelio-store-selection" && info.selectionText) {
    const key = `selection-${Date.now()}`;
    await uStore.local.set(key, {
      text: info.selectionText,
      url: tab?.url ?? "",
      title: tab?.title ?? "",
      timestamp: new Date().toISOString(),
    });
    await note.success(`Stored selection as "${key}"`);
  }

  if (info.menuItemId === "waelio-copy-as-base64" && info.selectionText) {
    const encoded = btoa(unescape(encodeURIComponent(info.selectionText)));
    // Send to content script to copy to clipboard
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: "COPY_TO_CLIPBOARD",
        payload: encoded,
      });
      await note.info("Base64 copied to clipboard");
    }
  }

  if (info.menuItemId === "waelio-open-docs") {
    await chrome.tabs.create({ url: "https://waelio.com/docs" });
  }

  if (info.menuItemId === "waelio-view-storage") {
    const win = await chrome.windows.getCurrent();
    if (win.id !== undefined) {
      await chrome.sidePanel.open({ windowId: win.id });
    }
  }
});

// ── Message Router ──

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = async () => {
    const { type, payload } = message as { type: string; payload?: unknown };

    switch (type) {
      case "GET_CONFIG": {
        const allConfig = await config.getAll();
        return allConfig;
      }

      case "SET_CONFIG": {
        const { key, value } = payload as { key: string; value: unknown };
        await config.set(key, value);
        return { ok: true };
      }

      case "STORE_GET": {
        const { backend, key } = payload as { backend: string; key: string };
        const store = uStore[backend as keyof typeof uStore];
        if (!store || !("get" in store)) return { error: "Invalid backend" };
        const value = await store.get(key);
        return { value };
      }

      case "STORE_SET": {
        const { backend, key, value } = payload as { backend: string; key: string; value: unknown };
        const store = uStore[backend as keyof typeof uStore];
        if (!store || !("set" in store)) return { error: "Invalid backend" };
        await store.set(key, value);
        return { ok: true };
      }

      case "STORE_GET_ALL": {
        const { backend } = payload as { backend: string };
        const store = uStore[backend as keyof typeof uStore];
        if (!store) return { error: "Invalid backend" };
        if ("getAll" in store) {
          const all = await (store as { getAll: () => Promise<Record<string, unknown>> }).getAll();
          return all;
        }
        if ("snapshot" in store) {
          return (store as { snapshot: () => Record<string, unknown> }).snapshot();
        }
        return {};
      }

      case "NOTIFY": {
        const { level, message: msg } = payload as { level: string; message: string };
        const method = note[level as keyof typeof note];
        if (typeof method === "function") {
          await (method as (m: string) => Promise<string>)(msg);
        }
        return { ok: true };
      }

      case "FETCH_NPM": {
        const { name } = payload as { name: string };
        const [metaErr, metaResp] = await to(fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`));
        if (metaErr || !metaResp?.ok) return { error: metaErr?.message ?? "Failed" };
        const meta = await metaResp.json();
        const [, dlResp] = await to(fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`));
        const downloads = dlResp?.ok ? await dlResp.json() : { downloads: 0 };
        return { meta, downloads };
      }

      default:
        return { error: `Unknown message type: ${type}` };
    }
  };

  handler().then(sendResponse).catch((err) => sendResponse({ error: String(err) }));
  return true; // async response
});

// ── Alarms (periodic refresh) ──

chrome.alarms.create("waelio-refresh", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "waelio-refresh") {
    const autoRefresh = await config.get("autoRefresh");
    if (autoRefresh === false) return;

    note.log("Periodic refresh triggered");
    // Future: refresh cached npm data, sync storage, etc.
  }
});

// ── Side Panel Behavior ──

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
