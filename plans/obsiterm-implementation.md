# Obsiterm — Implementation Plan

**Goal**: Turn the scaffold into a feature-rich, native-feeling Obsidian terminal plugin.
**Platform**: Desktop-only (`isDesktopOnly: true`).
**Layout modes**: Bottom panel (VS Code-style `ItemView`) + Floating modal.
**Must-have features**: Theme-matched colors · Hotkey toggle · Multiple tabs · Terminal search.

---

## Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

---

## Phases

### Phase 0 — Repository baseline
- [x] Rename/update `manifest.json`: id `obsiterm`, name `Obsiterm`, isDesktopOnly `true`
- [x] Update `package.json` name/description
- [x] Add npm dependencies: `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-search`, `@xterm/addon-web-links` (node-pty is external)
- [x] Update `esbuild.config.mjs` — add `node-pty` to externals list
- [x] Add `src/@types/node-pty.d.ts` type stub (node-pty is runtime-provided via Electron)

---

### Phase 1 — Shell & Theme utilities ✅
**Files created:**
- `src/utils/shell.ts` — detect default shell (macOS: `$SHELL`, Windows: `powershell.exe`, Linux: `$SHELL`)
- `src/utils/theme.ts` — read Obsidian CSS variables from `document.body` and return an `xterm.ITheme` object; re-run on `document.body` class mutation (theme switch)

**Key CSS vars to map → xterm colors:**
```
--background-primary       → background
--text-normal              → foreground
--text-muted               → cursor
--color-red/green/yellow/  → ANSI colors (fallback to xterm defaults)
  blue/purple/cyan/white
```

**Verification**: Unit-test `resolveTheme()` by mocking `getComputedStyle`; visually confirm colors update when toggling dark/light mode in Obsidian.

---

### Phase 2 — Terminal instance wrapper ✅
**File created:** `src/terminal/TerminalInstance.ts`

Encapsulates one terminal session:
- `xterm.Terminal` with `FitAddon`, `SearchAddon`, `WebLinksAddon`
- Spawns a `node-pty` `IPty` process (shell from settings or `shell.ts` default)
- Bidirectional data binding: pty output → xterm, xterm input → pty
- `resize(cols, rows)` — called on container resize
- `dispose()` — kills pty, disposes xterm, removes DOM
- Public refs: `terminal: Terminal`, `pty: IPty`, `element: HTMLElement`

**Verification**: Open terminal, run `echo hello`, see output; resize window and confirm terminal reflows.

---

### Phase 3 — Bottom panel (`ItemView`) ✅
**File created:** `src/terminal/TerminalView.ts`

- Extends `ItemView`, view type constant `TERMINAL_PANEL_VIEW`
- Toolbar with: `+` new tab · `×` close tab · shell name display · `⌕` search toggle
- Tab bar (delegates to `TerminalManager`)
- `xterm` render target `div` fills remaining height
- Uses `ResizeObserver` + `FitAddon` to reflow on panel resize
- Calls `theme.ts` on first open and on `MutationObserver` body class change

**Register in `main.ts`:**
```ts
this.registerView(TERMINAL_PANEL_VIEW, leaf => new TerminalView(leaf, this));
```

**Toggle command:**
```ts
this.addCommand({
  id: 'toggle-terminal-panel',
  name: 'Toggle terminal panel',
  hotkeys: [{ modifiers: ['Ctrl'], key: '`' }],
  callback: () => this.toggleTerminalPanel(),
})
```

`toggleTerminalPanel()`:
1. Check `app.workspace.getLeavesOfType(TERMINAL_PANEL_VIEW)` — if exists, focus/reveal; else create bottom leaf.
2. To close: `leaf.detach()`.

**Verification**: Hotkey opens panel at the bottom; panel persists after switching notes; terminal session survives navigation.

---

### Phase 4 — Floating modal ✅
**File created:** `src/terminal/TerminalModal.ts`

- Extends `Modal`
- Creates one `TerminalInstance` and mounts it in `contentEl`
- Modal size: ~70 vw × 50 vh via inline style (respects Obsidian modal backdrop)
- Calls `fit.fit()` after `onOpen`
- Disposes instance in `onClose`

**Toggle command:**
```ts
this.addCommand({
  id: 'toggle-floating-terminal',
  name: 'Open floating terminal',
  hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: '`' }],
  callback: () => new TerminalModal(this.app, this).open(),
})
```

**Verification**: Shortcut opens a floating terminal centered over the workspace; Escape closes it and shell is killed cleanly.

---

### Phase 5 — Multiple tabs (TerminalManager) ✅
**Files created:** `src/terminal/TerminalManager.ts`, `src/ui/TerminalTabs.ts`

```ts
class TerminalManager {
  tabs: TerminalInstance[]
  activeIndex: number
  onCreate(): TerminalInstance   // spawn + push to tabs
  onClose(index: number): void   // dispose + remove
  onSwitch(index: number): void  // hide all, show active
}
```

**File to create:** `src/ui/TerminalTabs.ts`

- Renders a horizontal tab strip above the terminal
- Each tab: shell name + `×` close button
- Clicking tab → `manager.onSwitch(i)`; `+` button → `manager.onCreate()`
- Active tab styled with `--interactive-accent` border-bottom

**Integration**: `TerminalView` holds one `TerminalManager`; toolbar `+` button and `×` button delegate to it.

**Verification**: Create 3 tabs; switch between them; verify each has independent shell state; close middle tab and confirm others remain intact.

---

### Phase 6 — Settings ✅
**File updated:** `src/settings.ts`

```ts
interface OBSITermSettings {
  shellPath: string          // '' = auto-detect
  fontFamily: string         // 'monospace'
  fontSize: number           // 14
  scrollback: number         // 1000
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean       // true
  defaultLayout: 'panel' | 'floating' | 'ask'
}
```

**Settings tab sections:**
- **Shell**: Path input + "Detect" button that auto-fills from `shell.ts`
- **Appearance**: Font family, font size, cursor style, cursor blink
- **Behavior**: Scrollback lines, default layout preference

All changes immediately apply to existing open terminals (re-render xterm options via `terminal.options`).

**Verification**: Change font size in settings, see terminal update in real time without reopening.

---

### Phase 7 — Styles (`styles.css`) ✅
Key selectors:
```css
.obsiterm-container      /* full-size flex wrapper */
.obsiterm-toolbar        /* top toolbar bar */
.obsiterm-tabs           /* tab strip */
.obsiterm-tab            /* individual tab, .is-active */
.obsiterm-tab-close      /* × button inside tab */
.obsiterm-xterm-wrapper  /* grows to fill, contains xterm canvas */
.obsiterm-search-bar     /* search input, shown/hidden */
```

All colors reference Obsidian CSS vars (`--background-primary`, `--text-normal`, `--interactive-accent`, etc.) — no hard-coded hex.
Scrollbar styled with `::-webkit-scrollbar` to match panel scrollbars.

---

### Phase 8 — Wire everything in `main.ts` ✅
Rewrote `src/main.ts` (minimal):
- `registerView` for panel
- `addCommand` for panel toggle, floating toggle
- `addSettingTab`
- `loadSettings` / `saveSettings`
- `onunload` disposes any open terminal views

---

## File map (final state)

```
src/
  main.ts                        # Plugin lifecycle only
  settings.ts                    # OBSITermSettings + SettingsTab
  terminal/
    TerminalInstance.ts          # xterm + node-pty wrapper
    TerminalView.ts              # ItemView (bottom panel)
    TerminalModal.ts             # Modal (floating)
    TerminalManager.ts           # Multi-tab state
  ui/
    TerminalTabs.ts              # Tab strip DOM component
  utils/
    shell.ts                     # Default shell detection
    theme.ts                     # CSS var → xterm ITheme
plans/
  obsiterm-implementation.md     # This file (tracking)
styles.css                       # Plugin CSS
manifest.json                    # id: obsiterm, isDesktopOnly: true
```

---

## Dependencies to add

| Package | Purpose |
|---|---|
| `@xterm/xterm` | Terminal emulation |
| `@xterm/addon-fit` | Auto-resize to container |
| `@xterm/addon-search` | Search in terminal output |
| `@xterm/addon-web-links` | Clickable URLs in output |
| `node-pty` | Native PTY / shell spawning (external, not bundled) |

**esbuild external list addition:** `"node-pty"`
**node-pty prebuild note:** Copy the `.node` binary from `node_modules/node-pty/prebuilds/` to the plugin root during dev; document in `CLAUDE.md`.

---

## Implementation order (recommended)

1. Phase 0 — baseline + deps
2. Phase 1 — utils (shell, theme) — no UI needed to test
3. Phase 2 — TerminalInstance — verify raw xterm + pty works
4. Phase 3 — TerminalView (single tab first)
5. Phase 4 — TerminalModal
6. Phase 5 — multi-tab (TerminalManager + TerminalTabs)
7. Phase 6 — Settings
8. Phase 7 — Styles polish
9. Phase 8 — final main.ts cleanup
