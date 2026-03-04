/**
 * Rebuilds node-pty against the Electron version used by Obsidian.
 *
 * Usage:
 *   npm run rebuild:pty                  # auto-detect from installed electron
 *   npm run rebuild:pty -- 33.4.0        # specify version explicitly
 *
 * After running, copy node_modules/node-pty into the vault plugin directory:
 *   cp -r node_modules/node-pty <vault>/.obsidian/plugins/obsiterm/
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const __dirname = new URL('.', import.meta.url).pathname;
const root = resolve(__dirname, '..');

// 1. Resolve Electron version
let electronVersion = process.argv[2];

if (!electronVersion) {
	// Try to read from a locally installed electron package
	const electronPkg = resolve(root, 'node_modules', 'electron', 'package.json');
	if (existsSync(electronPkg)) {
		electronVersion = JSON.parse(readFileSync(electronPkg, 'utf-8')).version;
		console.log(`Detected electron ${electronVersion} from node_modules/electron`);
	}
}

if (!electronVersion) {
	console.error(
		'Could not detect Electron version.\n' +
		'Find it in Obsidian: Help → About → "Electron ..."\n' +
		'Then run:  npm run rebuild:pty -- <version>   (e.g. 33.4.0)',
	);
	process.exit(1);
}

console.log(`Rebuilding node-pty for Electron ${electronVersion} …`);

try {
	execSync(
		`npx @electron/rebuild -v ${electronVersion} -w node-pty`,
		{ cwd: root, stdio: 'inherit' },
	);
	console.log('\n✓ node-pty rebuilt successfully.');
	console.log('\nNow copy the module into your vault plugin folder:');
	console.log('  cp -r node_modules/node-pty <vault>/.obsidian/plugins/obsiterm/\n');
} catch {
	process.exit(1);
}
