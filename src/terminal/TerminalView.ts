import { ItemView, WorkspaceLeaf } from 'obsidian';
import type ObsitermPlugin from '../main';
import { TerminalManager } from './TerminalManager';
import { TerminalTabs } from '../ui/TerminalTabs';
import { resolveTheme, watchTheme } from '../utils/theme';

export const TERMINAL_PANEL_VIEW = 'obsiterm-panel';

export class TerminalView extends ItemView {
	private manager: TerminalManager;
	private tabs: TerminalTabs;
	private terminalContainer: HTMLElement;
	private searchBar: HTMLElement;
	private searchInput: HTMLInputElement;
	private resizeObserver: ResizeObserver;
	private stopWatchingTheme: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: ObsitermPlugin,
	) {
		super(leaf);
	}

	getViewType(): string { return TERMINAL_PANEL_VIEW; }
	getDisplayText(): string { return 'Terminal'; }
	getIcon(): string { return 'terminal'; }

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.classList.add('obsiterm-container');

		// --- Toolbar ---
		const toolbar = root.createEl('div', { cls: 'obsiterm-toolbar' });
		const searchToggle = toolbar.createEl('button', {
			cls: 'obsiterm-toolbar-btn',
			text: '⌕',
			attr: { 'aria-label': 'Toggle search' },
		});

		// --- Search bar — hidden by default ---
		// Use classList.add explicitly; passing both classes via cls string is unreliable
		this.searchBar = root.createEl('div', { cls: 'obsiterm-search-bar' });
		this.searchBar.classList.add('obsiterm-hidden');

		this.searchInput = this.searchBar.createEl('input', {
			cls: 'obsiterm-search-input',
			attr: { type: 'text', placeholder: 'Search terminal…' },
		});

		const prevBtn = this.searchBar.createEl('button', { text: '↑', cls: 'obsiterm-toolbar-btn' });
		const nextBtn = this.searchBar.createEl('button', { text: '↓', cls: 'obsiterm-toolbar-btn' });
		const closeSearch = this.searchBar.createEl('button', { text: '×', cls: 'obsiterm-toolbar-btn' });

		// --- Tab strip ---
		this.tabs = new TerminalTabs({
			onAdd: () => {
				this.manager.create(this.terminalContainer);
				this.renderTabs();
			},
			onClose: (i) => {
				this.manager.close(i);
				if (this.manager.tabs.length === 0) {
					this.manager.create(this.terminalContainer);
				}
				this.renderTabs();
			},
			onSwitch: (i) => {
				this.manager.switchTo(i);
				this.renderTabs();
			},
		});
		root.appendChild(this.tabs.element);

		// --- Terminal container ---
		this.terminalContainer = root.createEl('div', { cls: 'obsiterm-terminal-container' });

		// --- Manager ---
		this.manager = new TerminalManager(
			this.plugin.settings,
			() => this.renderTabs(),
		);
		this.manager.create(this.terminalContainer);
		this.renderTabs();

		// --- Theme watcher ---
		this.stopWatchingTheme = watchTheme((theme) => {
			this.manager.applyTheme(theme);
		});

		// --- Search handlers ---
		searchToggle.addEventListener('click', () => {
			const hidden = this.searchBar.classList.contains('obsiterm-hidden');
			this.searchBar.classList.toggle('obsiterm-hidden');
			if (hidden) this.searchInput.focus();
		});

		closeSearch.addEventListener('click', () => {
			this.searchBar.classList.add('obsiterm-hidden');
			this.manager.activeTab?.focus();
		});

		nextBtn.addEventListener('click', () => {
			this.manager.activeTab?.findNext(this.searchInput.value);
		});

		prevBtn.addEventListener('click', () => {
			this.manager.activeTab?.findPrevious(this.searchInput.value);
		});

		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				if (e.shiftKey) this.manager.activeTab?.findPrevious(this.searchInput.value);
				else this.manager.activeTab?.findNext(this.searchInput.value);
			} else if (e.key === 'Escape') {
				this.searchBar.classList.add('obsiterm-hidden');
				this.manager.activeTab?.focus();
			}
		});

		// --- ResizeObserver ---
		this.resizeObserver = new ResizeObserver(() => {
			this.manager.fit();
		});
		this.resizeObserver.observe(this.terminalContainer);
	}

	async onClose(): Promise<void> {
		this.stopWatchingTheme?.();
		this.resizeObserver?.disconnect();
		this.manager?.disposeAll();
	}

	onSettingsChange(): void {
		this.manager?.applySettings(this.plugin.settings);
	}

	onThemeChange(): void {
		this.manager?.applyTheme(resolveTheme());
	}

	private renderTabs(): void {
		this.tabs.render(
			this.manager.tabs,
			this.manager.activeIndex,
			this.plugin.settings.shellPath,
		);
	}
}
