import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, OBSITermSettings, OBSITermSettingTab } from './settings';
import { TERMINAL_PANEL_VIEW, TerminalView } from './terminal/TerminalView';
import { TerminalModal } from './terminal/TerminalModal';

export default class ObsitermPlugin extends Plugin {
	settings: OBSITermSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Register the bottom-panel view
		this.registerView(
			TERMINAL_PANEL_VIEW,
			(leaf: WorkspaceLeaf) => new TerminalView(leaf, this),
		);

		// Command: toggle bottom panel
		this.addCommand({
			id: 'toggle-terminal-panel',
			name: 'Toggle terminal panel',
			callback: () => { void this.toggleTerminalPanel(); },
		});

		// Command: open floating terminal
		this.addCommand({
			id: 'toggle-floating-terminal',
			name: 'Open floating terminal',
			callback: () => new TerminalModal(this.app, this).open(),
		});

		// Settings tab
		this.addSettingTab(new OBSITermSettingTab(this.app, this));
	}

	onunload(): void {
		// Detach any open terminal panel leaves (disposes via onClose)
		this.app.workspace.getLeavesOfType(TERMINAL_PANEL_VIEW).forEach(l => l.detach());
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<OBSITermSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** Propagate settings changes to all open terminal views. */
	notifySettingsChanged(): void {
		this.app.workspace.getLeavesOfType(TERMINAL_PANEL_VIEW).forEach(leaf => {
			const view = leaf.view;
			if (view instanceof TerminalView) view.onSettingsChange();
		});
	}

	private async toggleTerminalPanel(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(TERMINAL_PANEL_VIEW);

		if (existing.length > 0) {
			const leaf = existing[0]!;
			if (this.app.workspace.getActiveViewOfType(TerminalView)) {
				leaf.detach();
			} else {
				await this.app.workspace.revealLeaf(leaf);
				leaf.view.containerEl.focus();
			}
			return;
		}

		// Open a new bottom leaf
		const leaf = this.app.workspace.getLeaf('split');
		await leaf.setViewState({ type: TERMINAL_PANEL_VIEW, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}
