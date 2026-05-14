# @waelio/extension

Chrome Extension (Manifest V3) — browser companion for all `@waelio` packages.

## Features

- **Popup** — Quick storage access, action buttons
- **Side Panel** — Live npm package data, storage browser, searchable API reference
- **Context Menus** — Store text selections, copy as Base64, open docs
- **Notifications** — OS-level alerts via `note.success()` / `.error()` / `.warning()`
- **Content Scripts** — Injected on waelio.com and localhost
- **Cross-device config** — Settings sync via `chrome.storage.sync`

## @waelio Tool Mapping

| Your Package | Extension Adapter |
|:---|:---|
| `uStore.local` | `chrome.storage.local` |
| `uStore.session` | `chrome.storage.session` |
| `uStore.config` | `chrome.storage.sync` (cross-device) |
| `uStore.memory` | In-memory Map |
| `uStore.signal` | `chrome.storage.onChanged` (cross-context reactive) |
| `uStore.cookie` | `chrome.cookies` API |
| `note.success/error/warning/info` | `chrome.notifications` |
| `note.loading` | `chrome.action` badge |
| `config/conf` | `chrome.storage.sync` |
| `_encrypt/_decrypt` | `crypto.subtle` (hardware AES-GCM) |
| All other utils | Pure TypeScript (identical) |

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run watch
```

## Load in Chrome

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` directory

## Project Structure

```
extension/
├── manifest.json           # Extension config
├── src/
│   ├── service-worker.ts   # Background: menus, messages, alarms
│   ├── content.ts          # Page injection: clipboard, metadata
│   ├── popup.ts            # Popup UI logic
│   ├── sidepanel.ts        # Side panel: packages, storage, utils
│   ├── ustore.ts           # chrome.storage adapters
│   ├── note.ts             # chrome.notifications adapter
│   ├── config.ts           # chrome.storage.sync config
│   └── utils.ts            # Pure utility functions
├── popup/                  # Popup HTML + CSS
├── sidepanel/              # Side panel HTML + CSS
├── options/                # Settings page
├── styles/                 # Shared CSS
└── icons/                  # Extension icons
```

## License

MIT © [Wael Wahbeh](https://waelio.com)
