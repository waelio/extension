/**
 * @waelio/extension — note/Notify adapter for Chrome Extension notifications
 *
 * Maps the note interface to chrome.notifications + chrome.action badge:
 *   note.success()       → chrome.notifications (green icon)
 *   note.error()         → chrome.notifications (red icon)
 *   note.warning()       → chrome.notifications (yellow icon)
 *   note.info()          → chrome.notifications (blue icon)
 *   note.loading.start() → chrome.action badge "⏳"
 *   note.loading.stop()  → clear badge
 *   note.dialog()        → chrome.windows.create popup
 */

type NotifyLevel = "success" | "error" | "warning" | "info";

interface NoteIcons {
  success: string;
  error: string;
  warning: string;
  info: string;
}

const ICONS: NoteIcons = {
  success: "icons/icon-48.png",
  error: "icons/icon-48.png",
  warning: "icons/icon-48.png",
  info: "icons/icon-48.png",
};

const TITLES: Record<NotifyLevel, string> = {
  success: "✅ Success",
  error: "❌ Error",
  warning: "⚠️ Warning",
  info: "ℹ️ Info",
};

const BADGE_COLORS: Record<NotifyLevel, string> = {
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

function resolveMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    const response = record.response;
    if (typeof response === "object" && response !== null) {
      const respRecord = response as Record<string, unknown>;
      const data = respRecord.data;
      if (typeof data === "object" && data !== null) {
        const dataRecord = data as Record<string, unknown>;
        if (typeof dataRecord.message === "string") return dataRecord.message;
      }
      if (typeof data === "string") return data;
    }
  }
  return "Unknown error";
}

async function showNotification(level: NotifyLevel, message: string, config: Record<string, unknown> = {}): Promise<string> {
  const id = `waelio-${level}-${Date.now()}`;

  try {
    await chrome.notifications.create(id, {
      type: "basic",
      iconUrl: ICONS[level],
      title: (config.title as string) ?? TITLES[level],
      message,
      priority: level === "error" ? 2 : level === "warning" ? 1 : 0,
      ...(config.silent !== true ? {} : { silent: true }),
    });

    // Flash the badge briefly
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[level] });
    await chrome.action.setBadgeText({ text: level === "error" ? "!" : "✓" });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "" }).catch(() => {});
    }, 3000);
  } catch (error) {
    console.error(`@waelio/extension note.${level} failed:`, error);
  }

  return id;
}

// ── Loading (badge-based) ──

const loading = {
  async start(text = "..."): Promise<void> {
    try {
      await chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
      await chrome.action.setBadgeText({ text });
    } catch (error) {
      console.error("@waelio/extension note.loading.start failed:", error);
    }
  },

  async stop(): Promise<void> {
    try {
      await chrome.action.setBadgeText({ text: "" });
    } catch (error) {
      console.error("@waelio/extension note.loading.stop failed:", error);
    }
  },
};

// ── Dialog (popup window) ──

async function dialog(config: Record<string, unknown> = {}): Promise<chrome.windows.Window | null> {
  try {
    const url = (config.url as string) ?? chrome.runtime.getURL("popup/popup.html");
    const width = (config.width as number) ?? 420;
    const height = (config.height as number) ?? 520;

    return await chrome.windows.create({
      url,
      type: "popup",
      width,
      height,
      focused: true,
    });
  } catch (error) {
    console.error("@waelio/extension note.dialog failed:", error);
    return null;
  }
}

// ── The note object (matches your note interface) ──

export const note = {
  loading,
  dialog,

  show(message: string, style: NotifyLevel = "success", config: Record<string, unknown> = {}): Promise<string> {
    return showNotification(style, message, config);
  },

  success(message: string, config: Record<string, unknown> = {}): Promise<string> {
    return showNotification("success", message, config);
  },

  info(message: string, config: Record<string, unknown> = {}): Promise<string> {
    return showNotification("info", message, config);
  },

  warning(message: string, config: Record<string, unknown> = {}): Promise<string> {
    return showNotification("warning", message, config);
  },

  error(error: unknown, config: Record<string, unknown> = {}): Promise<string> {
    return showNotification("error", resolveMessage(error), config);
  },

  log(...args: unknown[]): void {
    console.log("[waelio]", ...args);
  },

  debug(title: string, err?: unknown): void {
    if (err !== undefined) {
      console.log(`[waelio] ${title}`, JSON.stringify(err, null, 2));
    } else {
      console.log(`[waelio] ${title}`);
    }
  },
};

export const Notify = {
  create(payload: Record<string, unknown>): Promise<string> {
    const level = (payload.type as NotifyLevel) ?? "info";
    const message = (payload.message as string) ?? "";
    return showNotification(level, message, payload);
  },
};

export const configureNote = (_adapters: Record<string, unknown> = {}): typeof note => {
  // In extension context, we always use chrome.notifications
  // No Quasar adapter needed
  return note;
};

export default note;
