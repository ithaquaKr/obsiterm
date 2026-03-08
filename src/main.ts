import { FileSystemAdapter, Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, OBSITermSettings, OBSITermSettingTab } from './settings';
import { TERMINAL_PANEL_VIEW, TerminalView } from './terminal/TerminalView';
import { TerminalModal } from './terminal/TerminalModal';
import { TerminalManager, TabChangeCallback } from './terminal/TerminalManager';

export default class ObsitermPlugin extends Plugin {
	settings: OBSITermSettings;

	// Persisted for the plugin's lifetime — survives view show/hide cycles
	private _manager: TerminalManager | null = null;
	private _modal: TerminalModal | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			TERMINAL_PANEL_VIEW,
			(leaf: WorkspaceLeaf) => new TerminalView(leaf, this),
		);

		this.addCommand({
			id: 'toggle-terminal-panel',
			name: 'Toggle terminal panel',
			callback: () => { void this.toggleTerminalPanel(); },
		});

		this.addCommand({
			id: 'toggle-floating-terminal',
			name: 'Toggle floating terminal',
			callback: () => this.toggleFloatingTerminal(),
		});

		this.addSettingTab(new OBSITermSettingTab(this.app, this));
	}

	onunload(): void {
		this._modal?.close();
		this._modal = null;
		// Dispose sessions first, then detach leaves.
		// onClose() on each view does NOT touch sessions, so order is safe.
		this._manager?.disposeAll();
		this._manager = null;
		this.app.workspace.getLeavesOfType(TERMINAL_PANEL_VIEW).forEach(l => l.detach());
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<OBSITermSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	getOrCreateManager(onTabChange: TabChangeCallback): TerminalManager {
		if (!this._manager) {
			this._manager = new TerminalManager(this.settings, this.pluginDir, onTabChange);
		} else {
			this._manager.setOnTabChange(onTabChange);
		}
		return this._manager;
	}

	notifySettingsChanged(): void {
		this._manager?.applySettings(this.settings);
	}

	get pluginDir(): string {
		const adapter = this.app.vault.adapter;
		const dir = this.manifest.dir ?? `.obsidian/plugins/${this.manifest.id}`;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath() + '/' + dir;
		}
		return dir;
	}

	private toggleFloatingTerminal(): void {
		if (this._modal) {
			this._modal.close();
			// _modal is nulled by the onClosed callback
			return;
		}
		this._modal = new TerminalModal(this.app, this, () => { this._modal = null; });
		this._modal.open();
	}

	private async toggleTerminalPanel(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(TERMINAL_PANEL_VIEW);

		if (existing.length > 0) {
			const leaf = existing[0]!;

			if (this.app.workspace.getActiveViewOfType(TerminalView)) {
				// Terminal is active — shift focus back to the editor
				const mdLeaves = this.app.workspace.getLeavesOfType('markdown');
				const target = mdLeaves[0];
				if (target) {
					this.app.workspace.setActiveLeaf(target, { focus: true });
				}
			} else {
				// Terminal exists but not focused — bring it up
				await this.app.workspace.revealLeaf(leaf);
			}
			return;
		}

		// No terminal leaf exists yet — create one
		const leaf = this.app.workspace.getLeaf('split');
		await leaf.setViewState({ type: TERMINAL_PANEL_VIEW, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}
