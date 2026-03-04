import { App, PluginSettingTab, Setting } from 'obsidian';
import type ObsitermPlugin from './main';
import { detectDefaultShell } from './utils/shell';

export interface OBSITermSettings {
	shellPath: string;
	fontFamily: string;
	fontSize: number;
	scrollback: number;
	cursorStyle: 'block' | 'underline' | 'bar';
	cursorBlink: boolean;
	defaultLayout: 'panel' | 'floating' | 'ask';
}

export const DEFAULT_SETTINGS: OBSITermSettings = {
	shellPath: '',
	fontFamily: 'monospace',
	fontSize: 14,
	scrollback: 1000,
	cursorStyle: 'block',
	cursorBlink: true,
	defaultLayout: 'panel',
};

export class OBSITermSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: ObsitermPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// --- Shell ---
		new Setting(containerEl).setName('Shell').setHeading();

		new Setting(containerEl)
			.setName('Shell path')
			.setDesc('Leave blank to auto-detect ($SHELL / powershell.exe).')
			.addText(text => text
				.setPlaceholder(detectDefaultShell())
				.setValue(this.plugin.settings.shellPath)
				.onChange(async (value) => {
					this.plugin.settings.shellPath = value;
					await this.plugin.saveSettings();
				}))
			.addButton(btn => btn
				.setButtonText('Detect')
				.onClick(async () => {
					this.plugin.settings.shellPath = detectDefaultShell();
					await this.plugin.saveSettings();
					this.display();
				}));

		// --- Appearance ---
		new Setting(containerEl).setName('Appearance').setHeading();

		new Setting(containerEl)
			.setName('Font family')
			.addText(text => text
				.setValue(this.plugin.settings.fontFamily)
				.onChange(async (value) => {
					this.plugin.settings.fontFamily = value;
					await this.plugin.saveSettings();
					this.plugin.notifySettingsChanged();
				}));

		new Setting(containerEl)
			.setName('Font size')
			.addSlider(slider => slider
				.setLimits(8, 32, 1)
				.setValue(this.plugin.settings.fontSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.fontSize = value;
					await this.plugin.saveSettings();
					this.plugin.notifySettingsChanged();
				}));

		new Setting(containerEl)
			.setName('Cursor style')
			.addDropdown(drop => drop
				.addOption('block', 'Block')
				.addOption('underline', 'Underline')
				.addOption('bar', 'Bar')
				.setValue(this.plugin.settings.cursorStyle)
				.onChange(async (value) => {
					this.plugin.settings.cursorStyle = value as OBSITermSettings['cursorStyle'];
					await this.plugin.saveSettings();
					this.plugin.notifySettingsChanged();
				}));

		new Setting(containerEl)
			.setName('Cursor blink')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.cursorBlink)
				.onChange(async (value) => {
					this.plugin.settings.cursorBlink = value;
					await this.plugin.saveSettings();
					this.plugin.notifySettingsChanged();
				}));

		// --- Behavior ---
		new Setting(containerEl).setName('Behavior').setHeading();

		new Setting(containerEl)
			.setName('Scrollback lines')
			.addSlider(slider => slider
				.setLimits(100, 10000, 100)
				.setValue(this.plugin.settings.scrollback)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.scrollback = value;
					await this.plugin.saveSettings();
					this.plugin.notifySettingsChanged();
				}));

		new Setting(containerEl)
			.setName('Default layout')
			.addDropdown(drop => drop
				.addOption('panel', 'Bottom panel')
				.addOption('floating', 'Floating modal')
				.setValue(this.plugin.settings.defaultLayout)
				.onChange(async (value) => {
					this.plugin.settings.defaultLayout = value as OBSITermSettings['defaultLayout'];
					await this.plugin.saveSettings();
				}));
	}
}
