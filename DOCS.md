# Obsiterm — Developer Documentation

A full-stack walkthrough of how this plugin works, why each decision was made,
and where to read deeper on every concept.

---

## Table of Contents

1. [Mental model — the three-layer stack](#1-mental-model)
2. [Build system (esbuild + TypeScript)](#2-build-system)
3. [Obsidian plugin lifecycle](#3-obsidian-plugin-lifecycle)
4. [xterm.js — the terminal renderer](#4-xtermjs)
5. [node-pty — the PTY process](#5-node-pty)
6. [Electron quirks you must know](#6-electron-quirks)
7. [Module-by-module walkthrough](#7-module-walkthrough)
8. [CSS architecture](#8-css-architecture)
9. [Session persistence strategy](#9-session-persistence)
10. [Keyboard / Scope system](#10-keyboard-scope)
11. [Theme bridging](#11-theme-bridging)
12. [Common extension points](#12-extension-points)

---

## 1. Mental model

The plugin connects three independent systems:

```
┌──────────────────────────────────────────────────────────┐
│  Obsidian UI  (ItemView / Modal / Workspace)             │
│    owns the DOM container, layout, commands, settings    │
├──────────────────────────────────────────────────────────┤
│  xterm.js  (@xterm/xterm)                                │
│    renders the terminal grid in a <canvas> element       │
│    handles ANSI escape codes, scrollback, search         │
├──────────────────────────────────────────────────────────┤
│  node-pty  (native Node addon)                           │
│    spawns a real shell (zsh / bash / powershell)         │
│    gives a bidirectional byte stream via a PTY           │
└──────────────────────────────────────────────────────────┘
```

The glue between xterm and node-pty is two event listeners:

```ts
// Shell → screen
pty.onData(data => terminal.write(data));

// Keyboard → shell
terminal.onData(data => pty.write(data));
```

Everything else in the codebase is plumbing around these two lines.

---

## 2. Build system

### esbuild

Obsidian plugins must ship as a single `main.js` CommonJS file.
`esbuild.config.mjs` handles this:

```js
// Key options
format: 'cjs',          // CommonJS — required by Obsidian
bundle: true,           // inline all src/ imports
sourcemap: 'inline',    // dev only — removed in production
external: [             // provided by Obsidian at runtime
  'obsidian', 'electron',
  '@codemirror/*', '@lezer/*',
  'node-pty',           // native addon — cannot be bundled
],
```

`node-pty` MUST be external. It's a native `.node` binary; esbuild cannot
bundle binary addons. It gets loaded at runtime via `require()` with an
absolute path (see §6).

`@xterm/*` packages CAN be bundled because they are pure JavaScript.

### TypeScript strict mode

`tsconfig.json` enables all strict checks including `noUncheckedIndexedAccess`,
which means `array[i]` returns `T | undefined`. You will see `tabs[i]!` (non-null
assertion) or explicit null checks throughout — this is intentional.

**Deep dive:** [esbuild docs](https://esbuild.github.io/api/) · [TS strict mode](https://www.typescriptlang.org/tsconfig#strict)

---

## 3. Obsidian plugin lifecycle

### Plugin class (`main.ts`)

`Plugin` is the entry point. Obsidian calls `onload()` when the plugin
activates and `onunload()` when it deactivates (disable/reload/quit).

```ts
export default class ObsitermPlugin extends Plugin {
  async onload() {
    await this.loadSettings();       // restore persisted data
    this.registerView(...);          // register custom view type
    this.addCommand(...);            // register palette commands
    this.addSettingTab(...);         // register settings UI
  }

  onunload() {
    // clean up everything you created
  }
}
```

**Rule:** anything registered with `this.registerXxx()` is auto-cleaned up.
Anything you create manually (DOM nodes, observers, PTY processes) must be
cleaned up explicitly in `onunload()` or in your view's `onClose()`.

### ItemView (`TerminalView.ts`)

`ItemView` is Obsidian's base class for custom panels. It lives inside a
`WorkspaceLeaf` — a slot in the Obsidian split/tab layout.

```
WorkspaceLeaf
  └─ containerEl           (the outer shell, managed by Obsidian)
       ├─ .view-header     (Obsidian's built-in nav bar — we hide this)
       └─ contentEl        (our content goes here)
            └─ .obsiterm-container
                 ├─ .obsiterm-header  (tabs + action buttons)
                 └─ .obsiterm-terminal-area
```

Key lifecycle methods:
- `onOpen()` — called when the leaf becomes visible; set up DOM + manager
- `onClose()` — called when the leaf is destroyed (user presses ×)

### Modal (`TerminalModal.ts`)

`Modal` is a floating overlay. Its structure:

```
.modal-container
  └─ .modal.obsiterm-modal
       └─ .modal-content.obsiterm-modal-content
            └─ (xterm element)
```

Key lifecycle: `onOpen()` / `onClose()`.

Obsidian adds a `.modal-close-button` (the × circle) by default — we hide it
with CSS since we use the toggle hotkey to close.

**Deep dive:** [Obsidian Plugin API docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

---

## 4. xterm.js

xterm.js renders a terminal grid in a `<canvas>` element using WebGL or DOM
fallback. It understands VT100/VT220/xterm ANSI escape sequences.

### Setup pattern

```ts
// 1. Create wrapper div and attach to DOM FIRST
const element = document.createElement('div');
container.appendChild(element);   // ← must be in DOM before open()

// 2. Create terminal with options
const terminal = new Terminal({ fontFamily, fontSize, theme, ... });

// 3. Load addons
terminal.loadAddon(new FitAddon());
terminal.loadAddon(new SearchAddon());
terminal.loadAddon(new WebLinksAddon());

// 4. Open — renders the canvas into the element
terminal.open(element);

// 5. Fit to container dimensions (after next frame so CSS is applied)
requestAnimationFrame(() => fitAddon.fit());
```

**Why DOM first?** `terminal.open()` reads the element's pixel dimensions to
size the canvas. If the element is not yet in the DOM (or has `display:none`),
it gets zero dimensions and the terminal renders at 0×0.

### FitAddon

Calculates how many columns/rows fit in the container based on font metrics,
then sets `terminal.cols` and `terminal.rows`. You must call `fit()` whenever
the container resizes.

```ts
// Respond to container size changes
new ResizeObserver(() => fitAddon.fit()).observe(containerElement);
```

After calling `fit()`, sync the PTY to match:

```ts
pty.resize(terminal.cols, terminal.rows);
```

If you skip this sync, the shell thinks the terminal is a different size than
what xterm renders — output will wrap at wrong column widths.

### SearchAddon

```ts
searchAddon.findNext('query', { caseSensitive: false, regex: false });
searchAddon.findPrevious('query');
```

Highlights matches directly in the terminal buffer. The floating search
overlay in `TerminalView` is wired to these methods.

**Deep dive:** [xterm.js GitHub](https://github.com/xtermjs/xterm.js) · [xterm API reference](https://xtermjs.org/docs/api/terminal/)

---

## 5. node-pty

node-pty spawns a shell process connected to a pseudo-terminal (PTY). A PTY
is a kernel-level abstraction that makes the shell believe it is running in a
real terminal — it enables line editing (readline), cursor movement, color
output, and window-resize signals.

### Spawning

```ts
const pty = nodePty.spawn('/bin/zsh', ['-l'], {
  name: 'xterm-color',  // $TERM — tells shell what escape codes to use
  cols: 120,
  rows: 30,
  cwd: process.env['HOME'],
  env: process.env,
});
```

**`-l` flag (login shell):** On macOS, GUI apps do not inherit the full
`$PATH` from your shell config. Passing `-l` sources `~/.zprofile` /
`~/.bash_profile`, which is where tools like Homebrew (`/opt/homebrew/bin`)
add themselves. Without `-l`, commands like `brew`, `node`, `python` are
"not found". VS Code and iTerm2 both do this.

### Resize

When the container changes size, you must signal the PTY:

```ts
pty.resize(cols, rows);  // sends SIGWINCH to the shell process
```

The shell reads the new size via `ioctl(TIOCGWINSZ)` and redraws.

### Data flow

```
User types keystroke
  → xterm captures it as a string (e.g. "\x1b[A" for Up arrow)
  → terminal.onData fires
  → pty.write(data)          ← sent to shell stdin
  → shell processes it
  → pty.onData fires with output bytes
  → terminal.write(data)     ← xterm renders the output
```

**Deep dive:** [node-pty GitHub](https://github.com/microsoft/node-pty) · [PTY Wikipedia](https://en.wikipedia.org/wiki/Pseudoterminal)

---

## 6. Electron quirks

Obsidian runs on Electron — a desktop app that embeds a Chromium browser
(renderer process) running Node.js. There are several traps:

### `__dirname` is wrong in the renderer

In a normal Node.js script, `__dirname` is the directory of the current file.
In Electron's renderer process (where Obsidian plugin code runs), `__dirname`
resolves to inside `electron.asar/renderer/` — the Electron internals package.

**Do not use `__dirname` to locate plugin files.**

Instead, get the vault's filesystem path from Obsidian's API:

```ts
get pluginDir(): string {
  const adapter = this.app.vault.adapter;
  const dir = this.manifest.dir ?? `.obsidian/plugins/${this.manifest.id}`;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath() + '/' + dir;
  }
  return dir;
}
```

Then load node-pty with the absolute path:

```ts
const nodePty = require(path.join(this.pluginDir, 'node_modules', 'node-pty'));
```

### Native addon ABI compatibility

node-pty is a native `.node` binary (C++ compiled to machine code).
Node.js native addons are ABI-specific — a binary compiled for Node.js 20 will
NOT work in Electron 33, which uses a different V8/Node version.

You must recompile node-pty for Obsidian's specific Electron version:

```bash
# Check Obsidian's Electron version: Help → About
npx @electron/rebuild -v 33.3.2 -w node-pty
```

This regenerates `node_modules/node-pty/build/Release/pty.node` for the right ABI.

**Deep dive:** [Electron ABI guide](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) · [@electron/rebuild](https://github.com/electron/rebuild)

### `require()` in the renderer

Electron's renderer process has Node.js integration enabled in Obsidian.
You can use `require()` for built-in Node modules (`path`, `os`) and for
native addons. However, Obsidian's bundled code uses a module cache that's
separate from the regular Node.js module cache — this is why we use absolute
paths rather than relying on module resolution.

---

## 7. Module walkthrough

### `src/main.ts` — Plugin root

Owns two singletons that outlive the views:

```ts
private _manager: TerminalManager | null = null;  // panel sessions
private _modal: TerminalModal | null = null;        // floating modal
```

**`getOrCreateManager(onTabChange)`** — returns the existing manager or creates
a new one. When the panel view is recreated (user reopens it), the manager
already exists, so only the tab-change callback is updated.

**`toggleTerminalPanel()`** — never calls `leaf.detach()`. Instead it shifts
keyboard focus using `setActiveLeaf()`. The leaf stays alive in the workspace,
keeping the PTY sessions running.

**`onTerminalViewClosed()`** — called by `TerminalView.onClose()` when the user
explicitly closes the leaf (×). This is the only code path that disposes sessions.

**`toggleFloatingTerminal()`** — if `_modal` exists, close it; otherwise create
and open a new one. The `onClosed` callback passed to `TerminalModal` nulls
`_modal` so the state stays correct regardless of how the modal is closed.

---

### `src/terminal/TerminalInstance.ts` — One shell session

Wraps one `Terminal` (xterm) + one `IPty` (node-pty).

**Constructor sequence:**
1. Create `.obsiterm-xterm-wrapper` div and append to container (DOM first!)
2. Create `Terminal` and load addons
3. Call `terminal.open(element)` to render the canvas
4. `requestAnimationFrame(() => { fit(); spawnPty(); })` — deferred so CSS
   layout is complete before measuring cols/rows

**Why defer?** If `fit()` runs synchronously during `onOpen()`, the container
may not yet have its final CSS dimensions (especially a modal that just opened).
The shell would spawn at the wrong size, and its first prompt render would wrap
incorrectly — visible as a garbled line of characters at startup.

**`dispose()`** sets `disposed = true`, kills the PTY (`pty.kill()`), disposes
xterm, and removes the DOM element.

---

### `src/terminal/TerminalManager.ts` — Multi-tab state

Holds an array of `TerminalInstance` objects and tracks `activeIndex`.

**`reattach(container)`** — moves all xterm elements from the old container to
a new one without interrupting the PTY processes. The xterm `<canvas>` is a
regular DOM element and can be moved with `appendChild` just like any other node.

```ts
// Sessions keep running; only the DOM parent changes
for (const tab of this.tabs) {
  container.appendChild(tab.element);
}
```

**`setOnTabChange(cb)`** — the callback is invoked whenever tabs change. When
the view is recreated, this updates the callback to point to the new view
instance without creating a new manager.

---

### `src/terminal/TerminalView.ts` — Panel ItemView

Renders the header (tabs + `+` and `⌕` buttons) and the terminal area with a
floating search overlay.

The search overlay is `position: absolute` inside a `position: relative`
container. It appears/disappears with the `.obsiterm-hidden` class — no layout
shift because it doesn't occupy space in the flow.

Obsidian's built-in `.view-header` (the navigation bar with `‹ ›` arrows) is
hidden via CSS:

```css
.workspace-leaf-content[data-type="obsiterm-panel"] .view-header {
  display: none;
}
```

---

### `src/terminal/TerminalModal.ts` — Floating modal

Creates an independent `TerminalInstance` not shared with the panel.

**Toggle hotkey in modal scope:**

Obsidian's `Modal` pushes its own `Scope` onto the keymap stack when open.
Global command hotkeys are blocked by this scope — so pressing the toggle
hotkey while the modal is open would do nothing.

Fix: look up the user's configured hotkeys and register them directly on
`this.scope`:

```ts
const hotkeys: Hotkey[] = (this.app as any).hotkeyManager?.getHotkeys(commandId) ?? [];
for (const hk of hotkeys) {
  this.scope.register(hk.modifiers, hk.key, () => {
    this.close();
    return false;  // stop propagation
  });
}
```

`hotkeyManager` is not in Obsidian's public TypeScript types but exists at
runtime — hence the `(this.app as any)` cast.

---

### `src/ui/TerminalTabs.ts` — Tab strip

A plain class (not a React component) that manages a `<div class="obsiterm-tabs">`.
`render()` empties and rebuilds the tab list from scratch on every call.

Each tab: `[$icon] [shell name] [× close]`. The close button has `opacity: 0`
by default and becomes visible on hover via CSS, matching VS Code's behavior.

```ts
// Important: check which element was clicked to avoid
// triggering "switch tab" when the close button is pressed
tab.addEventListener('click', (e) => {
  if (e.target !== closeBtn) this.onSwitch(i);
});
closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();   // don't bubble to tab click
  this.onClose(i);
});
```

---

### `src/utils/theme.ts` — Theme bridge

Reads Obsidian's CSS custom properties and converts them to xterm's `ITheme`.
Obsidian exposes its color system via CSS variables on `document.body`, e.g.:

```
--background-primary   → background
--text-normal          → foreground
--color-red            → ANSI red (used by ls, git, etc.)
```

`watchTheme()` uses a `MutationObserver` on `document.body` watching for
`class` attribute changes — when Obsidian switches between light and dark mode,
it adds/removes a `theme-light` / `theme-dark` class on body. The observer
fires, reads the new CSS variables, and pushes the updated theme to all
xterm instances.

```ts
const observer = new MutationObserver(() => onThemeChange(resolveTheme()));
observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
```

**Deep dive:** [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) · [xterm ITheme](https://xtermjs.org/docs/api/terminal/interfaces/itheme/)

---

### `src/settings.ts` — Settings

`OBSITermSettings` is a plain interface. Persisted via `loadData()` / `saveData()`
(Obsidian serialises to `.obsidian/plugins/obsiterm/data.json`).

The safe merge pattern handles missing keys when the plugin is upgraded:

```ts
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
// If a new key was added to DEFAULT_SETTINGS, it appears with the default
// value rather than undefined.
```

`OBSITermSettingTab` uses Obsidian's `Setting` builder API:

```ts
new Setting(containerEl)
  .setName('Font size')          // label
  .setDesc('...')                // sub-label
  .addSlider(slider => slider    // control
    .setLimits(8, 32, 1)
    .setValue(current)
    .onChange(async (value) => { ... }));
```

Use `.setHeading()` for section titles — `createEl('h3')` violates the
`obsidianmd/settings-tab/no-manual-html-headings` lint rule.

---

## 8. CSS architecture

All classes are namespaced with `obsiterm-` to avoid collisions with Obsidian's
own classes or other plugins.

**Never use `.is-hidden`** — Obsidian has its own `.is-hidden` class which may
have unintended side effects. Use `.obsiterm-hidden` with `display: none !important`.

**`createEl('div', { cls: 'foo bar' })`** does NOT create two classes. Obsidian
treats the string as a single class name `"foo bar"`. Use separate `classList.add()` calls:

```ts
const el = parent.createEl('div', { cls: 'obsiterm-search-overlay' });
el.classList.add('obsiterm-hidden');  // second class added separately
```

**Layout structure:**

```
.obsiterm-container (flex column, 100% height)
  .obsiterm-header (flex row, 35px, shrink 0)
    .obsiterm-tabs (flex 1, overflow-x auto)
    .obsiterm-header-actions (flex row, shrink 0)
  .obsiterm-terminal-area (flex 1, position: relative)
    .obsiterm-terminal-container (flex 1)
      .obsiterm-xterm-wrapper (100% × 100%)
    .obsiterm-search-overlay (position: absolute, top-right)
```

The `position: relative` on `.obsiterm-terminal-area` is the containing block
for the absolutely-positioned search overlay. This means the search bar floats
over the terminal without shifting layout.

---

## 9. Session persistence strategy

**The problem:** Obsidian's `toggleTerminalPanel()` originally called `leaf.detach()`,
which triggers `onClose()` on the view, which destroys the DOM. Sessions were lost.

**The solution:** Never detach the leaf during toggle. Instead, shift keyboard
focus using `setActiveLeaf()`:

```ts
// Terminal is active → focus editor, but leave leaf alive
this.app.workspace.setActiveLeaf(editorLeaf, { focus: true });

// Terminal exists but not focused → bring it into view
await this.app.workspace.revealLeaf(terminalLeaf);
```

The leaf remains in the workspace layout. Its xterm canvases stay in the DOM.
PTY processes keep running. Sessions only end when the user explicitly closes
the leaf (×), which triggers `onClose()` → `plugin.onTerminalViewClosed()` →
`manager.disposeAll()`.

**Reattach after workspace restore:** If Obsidian restores the panel on startup
and the manager already has tabs, `reattach()` moves the existing xterm elements
into the new container:

```ts
if (this.manager.tabs.length === 0) {
  this.manager.create(this.terminalContainer);  // fresh session
} else {
  this.manager.reattach(this.terminalContainer); // restore sessions
}
```

---

## 10. Keyboard / Scope system

Obsidian has a layered keymap system. Each `Scope` is a map of key combos →
handlers. Scopes are pushed/popped onto a stack:

```
[global scope]  ← plugin commands registered here
[modal scope]   ← pushed when modal opens, popped on close
```

When a key is pressed, Obsidian walks the stack from top to bottom. The first
handler that matches and returns `false` (stop propagation) wins.

xterm.js also registers key listeners on its internal textarea in capture phase,
intercepting keystrokes before they bubble. This means xterm captures keys that
Obsidian's global scope would otherwise handle.

**Consequence:** When the floating modal is open and xterm has focus, global
plugin commands won't fire. Solution: register the hotkey on the modal's scope:

```ts
this.scope.register(['Mod'], 'j', () => { this.close(); return false; });
// 'Mod' = Cmd on macOS, Ctrl on Windows/Linux
```

**Deep dive:** [Obsidian Scope API](https://docs.obsidian.md/Reference/TypeScript+API/Scope)

---

## 11. Theme bridging

```
Obsidian CSS vars → resolveTheme() → xterm ITheme
```

The xterm `ITheme` specifies 16 ANSI colours plus background/foreground/cursor.
These map to what the shell uses when programs call e.g. `\x1b[31m` (red).

When Obsidian switches theme, the `watchTheme` MutationObserver fires and
calls `terminal.options.theme = newTheme`. xterm re-renders the canvas with
the new colours immediately.

To add a new colour mapping, edit the return object in `resolveTheme()`:

```ts
// Example: map Obsidian's orange to ANSI brightYellow
brightYellow: v('--color-orange') || '#fab387',
```

---

## 12. Extension points

### Add a new terminal command (e.g. "Clear terminal")

In `main.ts`:

```ts
this.addCommand({
  id: 'clear-terminal',
  name: 'Clear terminal',
  callback: () => {
    this._manager?.activeTab?.terminal.clear();
  },
});
```

### Change the default shell arguments

In `TerminalInstance.spawnPty()`, modify the args array:

```ts
// Current: login shell only
nodePty.spawn(shellPath, ['-l'], { ... });

// Interactive + login (sources .zshrc AND .zprofile):
nodePty.spawn(shellPath, ['-i', '-l'], { ... });
```

### Add a new xterm addon

Install the package, then load it in `TerminalInstance`:

```ts
import { ImageAddon } from '@xterm/addon-image';  // example

// In constructor, after other loadAddon calls:
this.terminal.loadAddon(new ImageAddon());
```

### Persist sessions across Obsidian restarts

Currently sessions die when Obsidian quits (the PTY process is killed).
To restore state, you would save the shell's current working directory and
command history to `plugin.saveData()`, then `cd` to the saved path on next
spawn. True session continuity would require a persistent daemon outside
Obsidian (e.g. tmux or a background process).

### Change terminal dimensions

The terminal size is purely driven by `FitAddon` reading the container's pixel
dimensions divided by font cell size. To enforce a minimum:

```ts
// In TerminalInstance.fit():
const cols = Math.max(40, this.terminal.cols);
const rows = Math.max(10, this.terminal.rows);
this.pty?.resize(cols, rows);
```

---

## Key references

| Topic | URL |
|---|---|
| Obsidian Plugin API | https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin |
| Obsidian TypeScript types | https://github.com/obsidianmd/obsidian-api |
| xterm.js API | https://xtermjs.org/docs/api/terminal/ |
| xterm.js addons | https://github.com/xtermjs/xterm.js/tree/master/addons |
| node-pty | https://github.com/microsoft/node-pty |
| Electron native modules | https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules |
| @electron/rebuild | https://github.com/electron/rebuild |
| PTY (pseudo-terminal) | https://man7.org/linux/man-pages/man7/pty.7.html |
| ANSI escape codes | https://en.wikipedia.org/wiki/ANSI_escape_code |
| MutationObserver | https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver |
| ResizeObserver | https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver |
| esbuild | https://esbuild.github.io/api/ |
