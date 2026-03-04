import type { TerminalInstance } from '../terminal/TerminalInstance';
import { detectDefaultShell } from '../utils/shell';

function shellLabel(shellPath: string): string {
	const full = shellPath || detectDefaultShell();
	return full.split('/').pop() ?? full;
}

export class TerminalTabs {
	readonly element: HTMLElement;

	private onClose: (index: number) => void;
	private onSwitch: (index: number) => void;

	constructor(opts: {
		onClose: (index: number) => void;
		onSwitch: (index: number) => void;
	}) {
		this.onClose = opts.onClose;
		this.onSwitch = opts.onSwitch;

		this.element = document.createElement('div');
		this.element.classList.add('obsiterm-tabs');
	}

	render(tabs: TerminalInstance[], activeIndex: number, shellPath: string): void {
		this.element.empty();

		const label = shellLabel(shellPath);

		tabs.forEach((_, i) => {
			const tab = this.element.createEl('div', { cls: 'obsiterm-tab' });
			if (i === activeIndex) tab.classList.add('is-active');

			// Shell icon
			tab.createEl('span', { text: '$', cls: 'obsiterm-tab-icon' });
			// Shell name
			tab.createEl('span', {
				text: tabs.length > 1 ? `${label} ${i + 1}` : label,
				cls: 'obsiterm-tab-name',
			});
			// Close — always in DOM, shown on hover/active via CSS
			const closeBtn = tab.createEl('span', { text: '×', cls: 'obsiterm-tab-close' });

			tab.addEventListener('click', (e) => {
				if (e.target !== closeBtn) this.onSwitch(i);
			});
			closeBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.onClose(i);
			});
		});
	}
}
