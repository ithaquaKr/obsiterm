# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode — compiles src/ to main.js with inline sourcemaps
npm run build        # Type-check + production build (minified, no sourcemap)
npm run lint         # Run ESLint (typescript-eslint + eslint-plugin-obsidianmd)
```

Version bumping (after manually updating `minAppVersion` in `manifest.json`):
```bash
npm version patch    # or minor / major — bumps manifest.json, package.json, versions.json
```

There are no automated tests. Testing is done by copying `main.js`, `manifest.json`, and `styles.css` into `<Vault>/.obsidian/plugins/<plugin-id>/` and reloading Obsidian.

## Architecture

This is an **Obsidian community plugin** written in TypeScript, bundled by esbuild into a single `main.js` at the repo root.

- **Entry point**: `src/main.ts` — exports the default `Plugin` subclass. esbuild bundles everything from here.
- **Settings**: `src/settings.ts` — holds the settings interface, defaults, and the `PluginSettingTab` subclass.
- `obsidian`, `electron`, and all `@codemirror/*` / `@lezer/*` packages are marked external (provided by the host app at runtime).
- Output format is CommonJS (`cjs`), targeting ES2018.

### Key patterns

- `main.ts` should stay minimal: lifecycle (`onload`/`onunload`), `addCommand`, `addSettingTab`, and `register*` calls only. Feature logic belongs in separate modules under `src/`.
- Always use `this.registerEvent`, `this.registerDomEvent`, and `this.registerInterval` instead of bare `addEventListener`/`setInterval` so listeners are automatically cleaned up on plugin unload.
- Persist settings with `this.loadData()` / `this.saveData()`; merge with `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` to handle missing keys on upgrade.
- Command IDs are stable API — never rename them after release.

### Manifest & versioning

- `manifest.json` maps to the installed plugin; `versions.json` maps `pluginVersion → minAppVersion` for older Obsidian clients.
- Release artifacts: `main.js`, `manifest.json`, `styles.css` — attached to a GitHub release whose tag exactly matches the version string (no leading `v`).

## TypeScript config

Strict mode is on: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitReturns`. `baseUrl` is set to `src/`, so imports within `src/` can be relative or use bare module names rooted at `src/`.
