import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { ISearchOptions } from '@xterm/addon-search';
import type { OBSITermSettings } from '../settings';
import { resolveTheme } from '../utils/theme';

type IPty = import('node-pty').IPty;

export class TerminalInstance {
	readonly terminal: Terminal;
	readonly element: HTMLElement;

	private pty: IPty | null = null;
	private fitAddon: FitAddon;
	private searchAddon: SearchAddon;
	private disposed = false;

	constructor(
		private readonly settings: OBSITermSettings,
		shellPath: string,
		container: HTMLElement,
		private readonly pluginDir: string,
	) {
		// Attach to DOM FIRST so xterm can measure real pixel dimensions
		this.element = document.createElement('div');
		this.element.classList.add('obsiterm-xterm-wrapper');
		container.appendChild(this.element);

		this.terminal = new Terminal({
			fontFamily: settings.fontFamily,
			fontSize: settings.fontSize,
			scrollback: settings.scrollback,
			cursorStyle: settings.cursorStyle,
			cursorBlink: settings.cursorBlink,
			theme: resolveTheme(),
			allowProposedApi: true,
		});

		this.fitAddon = new FitAddon();
		this.searchAddon = new SearchAddon();

		this.terminal.loadAddon(this.fitAddon);
		this.terminal.loadAddon(this.searchAddon);
		this.terminal.loadAddon(new WebLinksAddon());

		this.terminal.open(this.element);

		// Defer fit + PTY spawn to the next frame so the container's CSS
		// dimensions are fully applied before we measure cols/rows.
		requestAnimationFrame(() => {
			if (this.disposed) return;
			this.fitAddon.fit();
			this.spawnPty(shellPath);
		});
	}

	private spawnPty(shellPath: string): void {
		try {
			// Load from the plugin's own node_modules using the absolute path
			// supplied by Obsidian's FileSystemAdapter — __dirname is unreliable
			// in Electron's renderer and points to electron.asar, not the plugin.
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const pathMod = require('path') as typeof import('path');
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const nodePty = require(pathMod.join(this.pluginDir, 'node_modules', 'node-pty')) as typeof import('node-pty');
			const cols = this.terminal.cols > 0 ? this.terminal.cols : 80;
			const rows = this.terminal.rows > 0 ? this.terminal.rows : 24;

			// Spawn as a login shell (-l) so ~/.zprofile / ~/.bash_profile are
			// sourced and tools installed via Homebrew are on the PATH.
			// This matches what VS Code and iTerm2 do on macOS.
			this.pty = nodePty.spawn(shellPath, ['-l'], {
				name: 'xterm-color',
				cols,
				rows,
				cwd: process.env['HOME'] ?? process.cwd(),
				env: process.env as Record<string, string>,
			});

			this.pty.onData((data: string) => {
				if (!this.disposed) this.terminal.write(data);
			});

			this.terminal.onData((data: string) => {
				if (!this.disposed) this.pty?.write(data);
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.terminal.writeln('\r\n\x1b[1;31mObsiterm: failed to load node-pty\x1b[0m');
			this.terminal.writeln('\r\x1b[33m' + msg + '\x1b[0m');
			this.terminal.writeln('\r\nSee plugin README for setup instructions.');
		}
	}

	fit(): void {
		if (this.disposed) return;
		this.fitAddon.fit();
		if (this.pty) {
			this.pty.resize(
				Math.max(1, this.terminal.cols),
				Math.max(1, this.terminal.rows),
			);
		}
	}

	applyTheme(theme: import('@xterm/xterm').ITheme): void {
		this.terminal.options.theme = theme;
	}

	applySettings(settings: OBSITermSettings): void {
		this.terminal.options.fontFamily = settings.fontFamily;
		this.terminal.options.fontSize = settings.fontSize;
		this.terminal.options.scrollback = settings.scrollback;
		this.terminal.options.cursorStyle = settings.cursorStyle;
		this.terminal.options.cursorBlink = settings.cursorBlink;
		this.fit();
	}

	findNext(term: string, opts?: ISearchOptions): boolean {
		return this.searchAddon.findNext(term, opts);
	}

	findPrevious(term: string, opts?: ISearchOptions): boolean {
		return this.searchAddon.findPrevious(term, opts);
	}

	/** Re-fit and force a full redraw after DOM reattachment. */
	refresh(): void {
		if (this.disposed) return;
		this.fit();
		this.terminal.refresh(0, this.terminal.rows - 1);
		this.terminal.focus();
	}

	focus(): void {
		this.terminal.focus();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		try { this.pty?.kill(); } catch { /* ignore */ }
		this.terminal.dispose();
		this.element.remove();
	}
}
