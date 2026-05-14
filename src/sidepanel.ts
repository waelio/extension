/**
 * @waelio/extension — Side Panel script
 */

(() => {

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const PACKAGES = [
  "@waelio/utils", "waelio-utils", "@waelio/ustore", "@waelio/cli",
  "@waelio/data", "@waelio/agent", "@waelio/messaging", "@waelio/sync",
  "quasar-app-extension-waelio",
];

const UTILS_API = [
  { name: "_reactive", desc: "Reactive object with property tracking", cat: "Reactive" },
  { name: "_trickle", desc: "Reduces numbers array in stages", cat: "Reactive" },
  { name: "_jsonToQueryString", desc: "JSON → URL query string", cat: "Strings" },
  { name: "_queryStringToJson", desc: "URL query string → JSON", cat: "Strings" },
  { name: "_snakeToCamel", desc: "snake_case → camelCase", cat: "Strings" },
  { name: "_camelToSnake", desc: "camelCase → snake_case", cat: "Strings" },
  { name: "_toBase64", desc: "String → Base64", cat: "Strings" },
  { name: "_generateId", desc: "Random ID string", cat: "Strings" },
  { name: "_encrypt", desc: "Encrypt with salt", cat: "Crypto" },
  { name: "_decrypt", desc: "Decrypt value", cat: "Crypto" },
  { name: "_hideRandom", desc: "Mask random array indexes", cat: "Arrays" },
  { name: "_equals", desc: "Deep array equality", cat: "Arrays" },
  { name: "_chunk", desc: "Split array into chunks", cat: "Arrays" },
  { name: "_repeat", desc: "Run function N times", cat: "Arrays" },
  { name: "_rotate", desc: "Rotate matrix 90° CW", cat: "Arrays" },
  { name: "_transpose", desc: "Swap rows/columns", cat: "Arrays" },
  { name: "_deepClone", desc: "Deep clone objects", cat: "Objects" },
  { name: "_get", desc: "Safe nested access", cat: "Objects" },
  { name: "_omit", desc: "Exclude keys", cat: "Objects" },
  { name: "_pick", desc: "Pick keys", cat: "Objects" },
  { name: "_cleanResponse", desc: "Unwrap API response", cat: "Objects" },
  { name: "_isArray", desc: "Check Array", cat: "Types" },
  { name: "_isObject", desc: "Check Object", cat: "Types" },
  { name: "_isString", desc: "Check String", cat: "Types" },
  { name: "_isNumber", desc: "Check Number", cat: "Types" },
  { name: "_isValid", desc: "Check valid value", cat: "Types" },
  { name: "_fibonacci", desc: "Nth Fibonacci", cat: "Math" },
  { name: "_isPrime", desc: "Prime check", cat: "Math" },
  { name: "_sumOf", desc: "Sum array", cat: "Math" },
  { name: "_to", desc: "Promise → [err, result]", cat: "Other" },
  { name: "_notifyMe", desc: "Browser notification", cat: "Other" },
  { name: "_calculateClockDrift", desc: "JWT clock drift", cat: "Other" },
];

// ── Tabs ──

document.querySelectorAll<HTMLButtonElement>(".panel-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".panel-tab").forEach((t) => t.classList.remove("panel-tab-active"));
    document.querySelectorAll(".panel-content").forEach((c) => (c as HTMLElement).style.display = "none");
    tab.classList.add("panel-tab-active");
    const target = tab.dataset.tab ?? "";
    const section = document.getElementById(`tab-${target}`);
    if (section) section.style.display = "block";
  });
});

// ── Packages Tab ──

async function loadPackages(): Promise<void> {
  const container = $<HTMLDivElement>("packages-list");
  container.innerHTML = '<div class="panel-loading">Loading…</div>';

  const cards: string[] = [];

  for (const name of PACKAGES) {
    try {
      const result = await chrome.runtime.sendMessage({ type: "FETCH_NPM", payload: { name } });
      if (result.error) throw new Error(result.error);

      const meta = result.meta as Record<string, unknown>;
      const dl = result.downloads as Record<string, unknown>;
      const distTags = (meta["dist-tags"] ?? {}) as Record<string, string>;
      const version = distTags.latest ?? "";
      const description = (meta.description as string) ?? "";
      const downloads = Number(dl.downloads ?? 0);

      cards.push(`
        <div class="panel-pkg-card">
          <div class="panel-pkg-name">${name}</div>
          <div class="panel-pkg-desc">${description}</div>
          <div class="panel-pkg-meta">
            <span>v<strong>${version}</strong></span>
            <span><strong>${new Intl.NumberFormat().format(downloads)}</strong>/wk</span>
          </div>
        </div>
      `);
    } catch {
      cards.push(`
        <div class="panel-pkg-card">
          <div class="panel-pkg-name">${name}</div>
          <div class="panel-pkg-desc panel-muted">Failed to load</div>
        </div>
      `);
    }
  }

  container.innerHTML = cards.join("");
}

void loadPackages();

// ── Storage Tab ──

$<HTMLButtonElement>("panel-refresh").addEventListener("click", async () => {
  const backend = $<HTMLSelectElement>("panel-backend").value;
  const list = $<HTMLDivElement>("panel-storage-list");
  list.innerHTML = '<span class="panel-muted">Loading…</span>';

  const result = await chrome.runtime.sendMessage({ type: "STORE_GET_ALL", payload: { backend } });

  if (result && typeof result === "object" && !("error" in result)) {
    const entries = Object.entries(result);
    if (entries.length === 0) {
      list.innerHTML = '<span class="panel-muted">(empty)</span>';
    } else {
      list.innerHTML = entries.map(([k, v]) =>
        `<div class="panel-kv-row"><span class="panel-kv-key">${k}</span><span class="panel-kv-value">${JSON.stringify(v)}</span></div>`
      ).join("");
    }
  } else {
    list.innerHTML = `<span class="panel-muted">Error: ${(result as Record<string, string>)?.error ?? "Unknown"}</span>`;
  }
});

$<HTMLButtonElement>("panel-save").addEventListener("click", async () => {
  const backend = $<HTMLSelectElement>("panel-backend").value;
  const key = $<HTMLInputElement>("panel-key").value.trim();
  const value = $<HTMLInputElement>("panel-value").value.trim();
  if (!key) return;

  await chrome.runtime.sendMessage({ type: "STORE_SET", payload: { backend, key, value } });
  $<HTMLInputElement>("panel-key").value = "";
  $<HTMLInputElement>("panel-value").value = "";
  $<HTMLButtonElement>("panel-refresh").click();
});

// ── Utils Tab ──

function renderUtils(search = ""): void {
  const list = $<HTMLDivElement>("utils-list");
  const filtered = search
    ? UTILS_API.filter((u) => u.name.toLowerCase().includes(search) || u.desc.toLowerCase().includes(search) || u.cat.toLowerCase().includes(search))
    : UTILS_API;

  list.innerHTML = filtered.map((u) =>
    `<div class="panel-util-row"><span class="panel-util-name">${u.name}</span><span class="panel-util-desc">${u.desc}</span></div>`
  ).join("") || '<span class="panel-muted">No matching utilities</span>';
}

renderUtils();

$<HTMLInputElement>("utils-search").addEventListener("input", (e) => {
  renderUtils((e.target as HTMLInputElement).value.toLowerCase());
});

})();
