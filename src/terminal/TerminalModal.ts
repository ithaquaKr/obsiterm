import { App, Hotkey, Modal, setIcon } from 'obsidian';
import type ObsitermPlugin from '../main';
import { TerminalInstance } from './TerminalInstance';
import { detectDefaultShell } from '../utils/shell';
import { watchTheme } from '../utils/theme';

export class TerminalModal extends Modal {
	private instance: TerminalInstance | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private stopWatchingTheme: (() => void) | null = null;
	private searchOverlay: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;

	constructor(
		app: App,
		private readonly plugin: ObsitermPlugin,
		private readonly onClosed?: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		contentEl.classList.add('obsiterm-modal-content');
		modalEl.classList.add('obsiterm-modal');

		// ── Header ───────────────────────────────────────────────────────────
		const header = contentEl.createEl('div', { cls: 'obsiterm-modal-header' });
		header.createEl('span', { cls: 'obsiterm-modal-title', text: 'Terminal' });
		const headerActions = header.createEl('div', { cls: 'obsiterm-modal-header-actions' });

		const searchToggle = headerActions.createEl('button', {
			cls: 'obsiterm-action-btn',
			attr: { title: 'Search (Ctrl+F)', 'aria-label': 'Search' },
		});
		setIcon(searchToggle, 'search');
		const closeBtn = headerActions.createEl('button', {
			cls: 'obsiterm-action-btn',
			attr: { title: 'Close (Esc)', 'aria-label': 'Close terminal' },
		});
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', () => this.close());

		// ── Terminal area ────────────────────────────────────────────────────
		const terminalArea = contentEl.createEl('div', { cls: 'obsiterm-modal-terminal-area' });

		// ── Search overlay ───────────────────────────────────────────────────
		this.searchOverlay = terminalArea.createEl('div', {
			cls: 'obsiterm-search-overlay obsiterm-hidden',
		});
		this.searchInput = this.searchOverlay.createEl('input', {
			cls: 'obsiterm-search-input',
			attr: { type: 'text', placeholder: 'Find' },
		});
		const prevBtn = this.searchOverlay.createEl('button', {
			cls: 'obsiterm-search-btn',
			attr: { title: 'Previous match (Shift+Enter)' },
		});
		setIcon(prevBtn, 'chevron-up');
		const nextBtn = this.searchOverlay.createEl('button', {
			cls: 'obsiterm-search-btn',
			attr: { title: 'Next match (Enter)' },
		});
		setIcon(nextBtn, 'chevron-down');
		const searchClose = this.searchOverlay.createEl('button', {
			cls: 'obsiterm-search-btn obsiterm-search-close',
			attr: { title: 'Close' },
		});
		setIcon(searchClose, 'x');
		searchClose.addEventListener('click', () => this.hideSearch());

		// ── Terminal instance ────────────────────────────────────────────────
		const shellPath = this.plugin.settings.shellPath || detectDefaultShell();
		this.instance = new TerminalInstance(this.plugin.settings, shellPath, terminalArea, this.plugin.pluginDir);

		// Watch theme
		this.stopWatchingTheme = watchTheme((theme) => {
			this.instance?.applyTheme(theme);
		});

		// Resize on container size change
		this.resizeObserver = new ResizeObserver(() => {
			this.instance?.fit();
		});
		this.resizeObserver.observe(terminalArea);

		// ── Event handlers ───────────────────────────────────────────────────
		searchToggle.addEventListener('click', () => this.toggleSearch());

		nextBtn.addEventListener('click', () => {
			if (this.searchInput) this.instance?.findNext(this.searchInput.value);
		});
		prevBtn.addEventListener('click', () => {
			if (this.searchInput) this.instance?.findPrevious(this.searchInput.value);
		});
		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				if (e.shiftKey) this.instance?.findPrevious(this.searchInput!.value);
				else this.instance?.findNext(this.searchInput!.value);
			} else if (e.key === 'Escape') {
				this.hideSearch();
			}
		});

		// ── Scope hotkeys ────────────────────────────────────────────────────
		// Register the toggle hotkey on the modal's scope so it fires even when
		// xterm has focus (the modal scope otherwise blocks global commands).
		const commandId = `${this.plugin.manifest.id}:toggle-floating-terminal`;
		// hotkeyManager is not in Obsidian's public typings but exists at runtime
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const hotkeys: Hotkey[] = (this.app as any).hotkeyManager?.getHotkeys(commandId) ?? [];
		for (const hk of hotkeys) {
			this.scope.register(hk.modifiers, hk.key, () => {
				this.close();
				return false;
			});
		}

		// Ctrl+F to toggle search (fires even when xterm has focus via scope)
		this.scope.register(['Ctrl'], 'f', (e) => {
			e.preventDefault();
			this.toggleSearch();
			return false;
		});

		// Focus the terminal after the layout settles
		requestAnimationFrame(() => this.instance?.focus());
	}

	onClose(): void {
		this.stopWatchingTheme?.();
		this.resizeObserver?.disconnect();
		this.instance?.dispose();
		this.instance = null;
		this.contentEl.empty();
		this.onClosed?.();
	}

	private toggleSearch(): void {
		const hidden = this.searchOverlay?.classList.contains('obsiterm-hidden');
		this.searchOverlay?.classList.toggle('obsiterm-hidden');
		if (hidden) {
			this.searchInput?.focus();
			this.searchInput?.select();
		} else {
			this.instance?.focus();
		}
	}

	private hideSearch(): void {
		this.searchOverlay?.classList.add('obsiterm-hidden');
		this.instance?.focus();
	}
}
