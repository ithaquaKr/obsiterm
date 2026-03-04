# Obsiterm

A native terminal emulator panel for [Obsidian](https://obsidian.md). Desktop only.

## Features

- **Bottom panel** — VS Code-style terminal panel that persists while you navigate notes
- **Floating modal** — quick-access terminal overlay
- **Multiple tabs** — open and switch between independent shell sessions
- **Theme-matched colors** — reads Obsidian's CSS variables; updates automatically when you switch dark/light mode
- **In-terminal search** — search through terminal output
- **Clickable URLs** — web links in terminal output open in your browser
- **Configurable** — shell path, font, font size, cursor style, scrollback, and more

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [release](https://github.com/ithaqua/obsiterm/releases).
2. Copy them to `<Vault>/.obsidian/plugins/obsiterm/`.
3. Copy the `node-pty` native binary for your platform from `node_modules/node-pty/prebuilds/<platform>/` into the same folder.
4. Enable **Obsiterm** in Obsidian → Settings → Community plugins.

## Usage

| Action | Default |
|---|---|
| Toggle terminal panel | Command palette → *Toggle terminal panel* |
| Open floating terminal | Command palette → *Open floating terminal* |
| New tab | `+` button in the tab strip |
| Close tab | `×` button on the tab |
| Search output | `⌕` button in the toolbar |

Assign hotkeys in Settings → Hotkeys → search "terminal".

## Settings

Open Settings → Obsiterm:

- **Shell path** — leave blank to auto-detect (`$SHELL` on macOS/Linux, `powershell.exe` on Windows)
- **Font family / Font size** — terminal font; changes apply immediately
- **Cursor style** — block, underline, or bar
- **Cursor blink** — toggle cursor blinking
- **Scrollback lines** — how many lines to keep in history
- **Default layout** — panel or floating

## Development

```bash
npm install      # install dependencies
npm run dev      # watch mode (compiles src/ → main.js with sourcemaps)
npm run build    # type-check + production build
npm run lint     # ESLint
```

After building, copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder and reload Obsidian.

## Requirements

- Obsidian **desktop** (macOS, Windows, Linux)
- Node.js v16+ (for development)
