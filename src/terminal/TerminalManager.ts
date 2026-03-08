import type { OBSITermSettings } from '../settings';
import { TerminalInstance } from './TerminalInstance';
import { detectDefaultShell } from '../utils/shell';
import { resolveTheme } from '../utils/theme';

export type TabChangeCallback = (tabs: TerminalInstance[], activeIndex: number) => void;

export class TerminalManager {
	readonly tabs: TerminalInstance[] = [];
	activeIndex = -1;

	private onTabChange: TabChangeCallback;

	constructor(
		private readonly settings: OBSITermSettings,
		private readonly pluginDir: string,
		onTabChange: TabChangeCallback,
	) {
		this.onTabChange = onTabChange;
	}

	/** Update the tab-change callback when the view is recreated. */
	setOnTabChange(cb: TabChangeCallback): void {
		this.onTabChange = cb;
	}

	get activeTab(): TerminalInstance | undefined {
		return this.tabs[this.activeIndex];
	}

	create(container: HTMLElement): TerminalInstance {
		const shellPath = this.settings.shellPath || detectDefaultShell();
		const instance = new TerminalInstance(this.settings, shellPath, container, this.pluginDir);
		instance.applyTheme(resolveTheme());

		this.tabs.push(instance);
		this.switchTo(this.tabs.length - 1);
		return instance;
	}

	/**
	 * Re-attach all existing terminal elements to a new container.
	 * Called when the view is reopened after being closed — PTY sessions
	 * have been running the whole time; only the DOM parent changes.
	 */
	reattach(container: HTMLElement): void {
		for (let i = 0; i < this.tabs.length; i++) {
			const tab = this.tabs[i]!;
			tab.element.classList.toggle('obsiterm-hidden', i !== this.activeIndex);
			container.appendChild(tab.element);
		}
		// Two rAF passes: first lets the browser compute layout for the new
		// container; second lets xterm's renderer react to the size change.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => this.activeTab?.refresh());
		});
		this.onTabChange(this.tabs, this.activeIndex);
	}

	switchTo(index: number): void {
		this.tabs.forEach((t, i) => {
			t.element.classList.toggle('obsiterm-hidden', i !== index);
		});
		this.activeIndex = index;
		const active = this.tabs[index];
		if (active) {
			active.focus();
			requestAnimationFrame(() => active.fit());
		}
		this.onTabChange(this.tabs, this.activeIndex);
	}

	close(index: number): void {
		const tab = this.tabs[index];
		if (!tab) return;

		tab.dispose();
		this.tabs.splice(index, 1);

		if (this.tabs.length === 0) {
			this.activeIndex = -1;
			this.onTabChange(this.tabs, this.activeIndex);
			return;
		}

		this.switchTo(Math.min(index, this.tabs.length - 1));
	}

	applyTheme(theme: import('@xterm/xterm').ITheme): void {
		for (const tab of this.tabs) tab.applyTheme(theme);
	}

	applySettings(settings: OBSITermSettings): void {
		for (const tab of this.tabs) tab.applySettings(settings);
	}

	fit(): void {
		this.activeTab?.fit();
	}

	disposeAll(): void {
		for (const tab of this.tabs) tab.dispose();
		this.tabs.length = 0;
		this.activeIndex = -1;
	}
}
