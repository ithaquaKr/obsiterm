import { App, Hotkey, Modal } from 'obsidian';
import type ObsitermPlugin from '../main';
import { TerminalInstance } from './TerminalInstance';
import { detectDefaultShell } from '../utils/shell';
import { watchTheme } from '../utils/theme';

export class TerminalModal extends Modal {
	private instance: TerminalInstance | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private stopWatchingTheme: (() => void) | null = null;

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

		const shellPath = this.plugin.settings.shellPath || detectDefaultShell();
		// contentEl is already in the DOM — pass it so xterm can measure on open
		this.instance = new TerminalInstance(this.plugin.settings, shellPath, contentEl, this.plugin.pluginDir);

		// Watch theme
		this.stopWatchingTheme = watchTheme((theme) => {
			this.instance?.applyTheme(theme);
		});

		// Resize on container size change
		this.resizeObserver = new ResizeObserver(() => {
			this.instance?.fit();
		});
		this.resizeObserver.observe(contentEl);

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
	}

	onClose(): void {
		this.stopWatchingTheme?.();
		this.resizeObserver?.disconnect();
		this.instance?.dispose();
		this.instance = null;
		this.contentEl.empty();
		this.onClosed?.();
	}
}
