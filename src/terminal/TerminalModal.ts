import { App, Modal } from 'obsidian';
import type ObsitermPlugin from '../main';
import { TerminalInstance } from './TerminalInstance';
import { detectDefaultShell } from '../utils/shell';
import { watchTheme } from '../utils/theme';

export class TerminalModal extends Modal {
	private instance: TerminalInstance | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private stopWatchingTheme: (() => void) | null = null;

	constructor(app: App, private readonly plugin: ObsitermPlugin) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		contentEl.classList.add('obsiterm-modal-content');
		modalEl.classList.add('obsiterm-modal');

		const shellPath = this.plugin.settings.shellPath || detectDefaultShell();
		// contentEl is already in the DOM — pass it so xterm can measure on open
		this.instance = new TerminalInstance(this.plugin.settings, shellPath, contentEl);

		// Fit after DOM settles
		requestAnimationFrame(() => this.instance?.fit());

		// Watch theme
		this.stopWatchingTheme = watchTheme((theme) => {
			this.instance?.applyTheme(theme);
		});

		// Resize on container size change
		this.resizeObserver = new ResizeObserver(() => {
			this.instance?.fit();
		});
		this.resizeObserver.observe(contentEl);
	}

	onClose(): void {
		this.stopWatchingTheme?.();
		this.resizeObserver?.disconnect();
		this.instance?.dispose();
		this.instance = null;
		this.contentEl.empty();
	}
}
