import { Platform } from 'obsidian';

/**
 * Returns the default shell path for the current OS.
 * On macOS/Linux: $SHELL env var, falling back to /bin/sh.
 * On Windows: powershell.exe.
 */
export function detectDefaultShell(): string {
	if (Platform.isWin) {
		return 'powershell.exe';
	}
	return process.env['SHELL'] ?? '/bin/sh';
}
