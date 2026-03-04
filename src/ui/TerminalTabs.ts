import type { TerminalInstance } from '../terminal/TerminalInstance';
import { detectDefaultShell } from '../utils/shell';

function shellLabel(shellPath: string): string {
	const full = shellPath || detectDefaultShell();
	return full.split('/').pop() ?? full;
}

export class TerminalTabs {
	readonly element: HTMLElement;

	private onAdd: () => void;
	private onClose: (index: number) => void;
	private onSwitch: (index: number) => void;

	constructor(opts: {
		onAdd: () => void;
		onClose: (index: number) => void;
		onSwitch: (index: number) => void;
	}) {
		this.onAdd = opts.onAdd;
		this.onClose = opts.onClose;
		this.onSwitch = opts.onSwitch;

		this.element = document.createElement('div');
		this.element.classList.add('obsiterm-tabs');
	}

	render(tabs: TerminalInstance[], activeIndex: number, shellPath: string): void {
		this.element.empty();

		tabs.forEach((_, i) => {
			const tab = this.element.createEl('div', { cls: 'obsiterm-tab' });
			if (i === activeIndex) tab.classList.add('is-active');

			tab.createEl('span', {
				text: shellLabel(shellPath) + (tabs.length > 1 ? ` ${i + 1}` : ''),
				cls: 'obsiterm-tab-label',
			});

			const closeBtn = tab.createEl('span', { text: '×', cls: 'obsiterm-tab-close' });

			tab.addEventListener('click', (e) => {
				if (e.target !== closeBtn) this.onSwitch(i);
			});
			closeBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.onClose(i);
			});
		});

		// "+" new tab button
		const addBtn = this.element.createEl('div', { cls: 'obsiterm-tab-add', text: '+' });
		addBtn.addEventListener('click', () => this.onAdd());
	}
}
