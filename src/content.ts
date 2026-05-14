/**
 * @waelio/extension — Content Script
 *
 * Injected into waelio.com and localhost pages.
 * Handles: clipboard operations, page data extraction, message relay.
 */

// ── Message Handler ──

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message as { type: string; payload?: unknown };

  switch (type) {
    case "COPY_TO_CLIPBOARD": {
      const text = payload as string;
      navigator.clipboard.writeText(text).then(() => {
        sendResponse({ ok: true });
      }).catch((err) => {
        sendResponse({ error: String(err) });
      });
      return true;
    }

    case "GET_PAGE_META": {
      const meta = {
        title: document.title,
        url: window.location.href,
        description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
        canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? "",
        h1: document.querySelector("h1")?.textContent?.trim() ?? "",
        links: Array.from(document.querySelectorAll("a[href]"), (a) => ({
          text: a.textContent?.trim() ?? "",
          href: (a as HTMLAnchorElement).href,
        })).slice(0, 50),
      };
      sendResponse(meta);
      return false;
    }

    case "GET_SELECTED_TEXT": {
      sendResponse({ text: window.getSelection()?.toString() ?? "" });
      return false;
    }

    case "INJECT_BADGE": {
      const existing = document.getElementById("waelio-ext-badge");
      if (existing) {
        existing.remove();
        sendResponse({ removed: true });
        return false;
      }

      const badge = document.createElement("div");
      badge.id = "waelio-ext-badge";
      badge.innerHTML = "🛠️ Waelio";
      badge.style.cssText = [
        "position: fixed",
        "bottom: 16px",
        "left: 16px",
        "z-index: 999999",
        "padding: 6px 14px",
        "border-radius: 999px",
        "background: rgba(99, 102, 241, 0.95)",
        "color: white",
        "font: 600 13px/1.4 system-ui, sans-serif",
        "cursor: pointer",
        "box-shadow: 0 4px 16px rgba(0,0,0,0.2)",
        "transition: transform 0.15s, opacity 0.15s",
        "backdrop-filter: blur(8px)",
      ].join("; ");

      badge.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
      });

      document.body.appendChild(badge);
      sendResponse({ injected: true });
      return false;
    }

    default:
      sendResponse({ error: `Unknown content message: ${type}` });
      return false;
  }
});

// ── Page Load Notification ──

if (window.location.hostname === "waelio.com" || window.location.hostname === "localhost") {
  console.log("[waelio-extension] Content script loaded on", window.location.href);
}
