import type { ITheme } from '@xterm/xterm';

/**
 * Reads Obsidian CSS variables from document.body computed style
 * and maps them to an xterm.js ITheme object.
 */
export function resolveTheme(): ITheme {
	const style = getComputedStyle(document.body);

	function v(varName: string): string {
		return style.getPropertyValue(varName).trim();
	}

	return {
		background:          v('--background-primary')          || '#1e1e2e',
		foreground:          v('--text-normal')                  || '#cdd6f4',
		cursor:              v('--text-muted')                   || '#f5e0dc',
		cursorAccent:        v('--background-primary')          || '#1e1e2e',
		selectionBackground: v('--text-selection')              || '#45475a',
		black:               v('--color-base-00')               || '#45475a',
		red:                 v('--color-red')                    || '#f38ba8',
		green:               v('--color-green')                  || '#a6e3a1',
		yellow:              v('--color-yellow')                 || '#f9e2af',
		blue:                v('--color-blue')                   || '#89b4fa',
		magenta:             v('--color-purple')                 || '#cba4f7',
		cyan:                v('--color-cyan')                   || '#89dceb',
		white:               v('--color-base-70')               || '#bac2de',
		brightBlack:         v('--color-base-40')               || '#585b70',
		brightRed:           v('--color-red')                    || '#f38ba8',
		brightGreen:         v('--color-green')                  || '#a6e3a1',
		brightYellow:        v('--color-yellow')                 || '#f9e2af',
		brightBlue:          v('--color-blue')                   || '#89b4fa',
		brightMagenta:       v('--color-purple')                 || '#cba4f7',
		brightCyan:          v('--color-cyan')                   || '#89dceb',
		brightWhite:         v('--color-base-100')              || '#a6adc8',
	};
}

/**
 * Observes document.body class changes (theme switches) and calls
 * onThemeChange() with a fresh ITheme whenever the theme changes.
 * Returns a cleanup function to disconnect the observer.
 */
export function watchTheme(onThemeChange: (theme: ITheme) => void): () => void {
	const observer = new MutationObserver(() => {
		onThemeChange(resolveTheme());
	});
	observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
	return () => observer.disconnect();
}
