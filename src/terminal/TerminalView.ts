import { ItemView, WorkspaceLeaf } from "obsidian";
import type ObsitermPlugin from "../main";
import type { TerminalManager } from "./TerminalManager";
import { TerminalTabs } from "../ui/TerminalTabs";
import { resolveTheme, watchTheme } from "../utils/theme";

export const TERMINAL_PANEL_VIEW = "obsiterm-panel";

export class TerminalView extends ItemView {
	private manager: TerminalManager;
	private tabs: TerminalTabs;
	private terminalContainer: HTMLElement;
	private searchOverlay: HTMLElement;
	private searchInput: HTMLInputElement;
	private resizeObserver: ResizeObserver;
	private stopWatchingTheme: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: ObsitermPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return TERMINAL_PANEL_VIEW;
	}
	getDisplayText(): string {
		return "Terminal";
	}
	getIcon(): string {
		return "terminal";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.classList.add("obsiterm-container");

		// ── Header ─────────────────────────────────────────────────────────────
		const header = root.createEl("div", { cls: "obsiterm-header" });

		this.tabs = new TerminalTabs({
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
		header.appendChild(this.tabs.element);

		const actions = header.createEl("div", {
			cls: "obsiterm-header-actions",
		});

		const newTabBtn = actions.createEl("button", {
			cls: "obsiterm-action-btn",
			text: "+",
			attr: { "aria-label": "New terminal", title: "New terminal" },
		});

		const searchToggle = actions.createEl("button", {
			cls: "obsiterm-action-btn",
			text: "⌕",
			attr: { "aria-label": "Search", title: "Search (Ctrl+F)" },
		});

		// ── Terminal area ───────────────────────────────────────────────────────
		const terminalArea = root.createEl("div", {
			cls: "obsiterm-terminal-area",
		});
		this.terminalContainer = terminalArea.createEl("div", {
			cls: "obsiterm-terminal-container",
		});

		// ── Search overlay ──────────────────────────────────────────────────────
		this.searchOverlay = terminalArea.createEl("div", {
			cls: "obsiterm-search-overlay",
		});
		this.searchOverlay.classList.add("obsiterm-hidden");

		this.searchInput = this.searchOverlay.createEl("input", {
			cls: "obsiterm-search-input",
			attr: { type: "text", placeholder: "Find" },
		});
		const prevBtn = this.searchOverlay.createEl("button", {
			cls: "obsiterm-search-btn",
			text: "↑",
			attr: { title: "Previous match (Shift+Enter)" },
		});
		const nextBtn = this.searchOverlay.createEl("button", {
			cls: "obsiterm-search-btn",
			text: "↓",
			attr: { title: "Next match (enter)" },
		});
		this.searchOverlay
			.createEl("button", {
				cls: "obsiterm-search-btn obsiterm-search-close",
				text: "×",
				attr: { title: "Close" },
			})
			.addEventListener("click", () => this.hideSearch());

		// ── Manager ────────────────────────────────────────────────────────────
		// Get or create the shared manager. If sessions already exist, reattach
		// their xterm elements to this view's new container without interrupting
		// the running PTY processes.
		this.manager = this.plugin.getOrCreateManager(() => this.renderTabs());

		if (this.manager.tabs.length === 0) {
			this.manager.create(this.terminalContainer);
		} else {
			this.manager.reattach(this.terminalContainer);
		}
		this.renderTabs();

		// ── Theme watcher ──────────────────────────────────────────────────────
		this.stopWatchingTheme = watchTheme((theme) => {
			this.manager.applyTheme(theme);
		});

		// ── Event handlers ─────────────────────────────────────────────────────
		newTabBtn.addEventListener("click", () => {
			this.manager.create(this.terminalContainer);
			this.renderTabs();
		});

		searchToggle.addEventListener("click", () => this.toggleSearch());

		nextBtn.addEventListener("click", () => {
			this.manager.activeTab?.findNext(this.searchInput.value);
		});

		prevBtn.addEventListener("click", () => {
			this.manager.activeTab?.findPrevious(this.searchInput.value);
		});

		this.searchInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				if (e.shiftKey)
					this.manager.activeTab?.findPrevious(
						this.searchInput.value,
					);
				else this.manager.activeTab?.findNext(this.searchInput.value);
			} else if (e.key === "Escape") {
				this.hideSearch();
			}
		});

		terminalArea.addEventListener("keydown", (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "f") {
				e.preventDefault();
				this.toggleSearch();
			}
		});

		// ── Resize observer ────────────────────────────────────────────────────
		this.resizeObserver = new ResizeObserver(() => this.manager.fit());
		this.resizeObserver.observe(this.terminalContainer);
	}

	async onClose(): Promise<void> {
		this.stopWatchingTheme?.();
		this.resizeObserver?.disconnect();
		// User explicitly closed the leaf — dispose sessions and release the manager.
		this.plugin.onTerminalViewClosed();
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

	private toggleSearch(): void {
		const hidden = this.searchOverlay.classList.contains("obsiterm-hidden");
		this.searchOverlay.classList.toggle("obsiterm-hidden");
		if (hidden) {
			this.searchInput.focus();
			this.searchInput.select();
		} else {
			this.manager.activeTab?.focus();
		}
	}

	private hideSearch(): void {
		this.searchOverlay.classList.add("obsiterm-hidden");
		this.manager.activeTab?.focus();
	}
}
