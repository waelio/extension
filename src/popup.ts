/**
 * @waelio/extension — Popup script
 */

(() => {

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

// ── Actions ──

$<HTMLButtonElement>("btn-docs").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://waelio.com/docs" });
  window.close();
});

$<HTMLButtonElement>("btn-sidepanel").addEventListener("click", async () => {
  const win = await chrome.windows.getCurrent();
  if (win.id !== undefined) {
    await chrome.sidePanel.open({ windowId: win.id });
  }
  window.close();
});

$<HTMLButtonElement>("btn-stats").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://waelio.com" });
  window.close();
});

// ── Quick Storage ──

$<HTMLButtonElement>("btn-store").addEventListener("click", async () => {
  const key = $<HTMLInputElement>("store-key").value.trim();
  const value = $<HTMLInputElement>("store-value").value.trim();
  const status = $<HTMLDivElement>("store-status");

  if (!key) {
    status.textContent = "⚠️ Key required";
    return;
  }

  await chrome.runtime.sendMessage({
    type: "STORE_SET",
    payload: { backend: "local", key, value },
  });

  status.textContent = `✅ Saved "${key}"`;
  $<HTMLInputElement>("store-key").value = "";
  $<HTMLInputElement>("store-value").value = "";

  setTimeout(() => { status.textContent = ""; }, 2000);
});

// ── Storage Viewer ──

$<HTMLButtonElement>("btn-load-storage").addEventListener("click", async () => {
  const backend = $<HTMLSelectElement>("storage-backend").value;
  const view = $<HTMLDivElement>("storage-contents");

  view.textContent = "Loading…";

  const result = await chrome.runtime.sendMessage({
    type: "STORE_GET_ALL",
    payload: { backend },
  });

  if (result && typeof result === "object" && !("error" in result)) {
    const entries = Object.entries(result);
    if (entries.length === 0) {
      view.textContent = "(empty)";
    } else {
      view.textContent = entries
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join("\n");
    }
  } else {
    view.textContent = `Error: ${(result as Record<string, string>)?.error ?? "Unknown"}`;
  }
});

})();
