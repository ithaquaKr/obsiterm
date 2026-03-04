declare module 'node-pty' {
	export interface IPtyForkOptions {
		name?: string;
		cols?: number;
		rows?: number;
		cwd?: string;
		env?: Record<string, string>;
	}

	export interface IPty {
		readonly pid: number;
		readonly process: string;
		write(data: string): void;
		resize(columns: number, rows: number): void;
		kill(signal?: string): void;
		onData(listener: (data: string) => void): { dispose(): void };
		onExit(listener: (e: { exitCode: number; signal?: number }) => void): { dispose(): void };
	}

	export function spawn(
		file: string,
		args: string[],
		options: IPtyForkOptions,
	): IPty;
}
