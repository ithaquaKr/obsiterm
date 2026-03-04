import type { OBSITermSettings } from '../settings';
import { TerminalInstance } from './TerminalInstance';
import { detectDefaultShell } from '../utils/shell';
import { resolveTheme } from '../utils/theme';

export interface TabChangeCallback {
	(tabs: TerminalInstance[], activeIndex: number): void;
}

export class TerminalManager {
	readonly tabs: TerminalInstance[] = [];
	activeIndex = -1;

	private onTabChange: TabChangeCallback;

	constructor(
		private readonly settings: OBSITermSettings,
		onTabChange: TabChangeCallback,
	) {
		this.onTabChange = onTabChange;
	}

	get activeTab(): TerminalInstance | undefined {
		return this.tabs[this.activeIndex];
	}

	create(container: HTMLElement): TerminalInstance {
		const shellPath = this.settings.shellPath || detectDefaultShell();
		// container is passed in so the element is in the DOM before xterm opens
		const instance = new TerminalInstance(this.settings, shellPath, container);
		instance.applyTheme(resolveTheme());

		this.tabs.push(instance);

		// Hide all others, show the new one
		this.switchTo(this.tabs.length - 1);
		return instance;
	}

	switchTo(index: number): void {
		this.tabs.forEach((t, i) => {
			t.element.classList.toggle('obsiterm-hidden', i !== index);
		});
		this.activeIndex = index;
		const active = this.tabs[index];
		if (active) {
			active.focus();
			// Fit after showing, in case dimensions changed while hidden
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

		// Pick a sensible next active tab
		const nextIndex = Math.min(index, this.tabs.length - 1);
		this.switchTo(nextIndex);
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
