import * as filesys from 'fs';
import * as path from 'path';

export namespace fs {
	export interface Stats extends filesys.Stats { }
	export type Files = { [file: string]: filesys.Stats; }

	export function readJSON<T>(filename: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			filesys.readFile(filename, 'UTF8', (error: NodeJS.ErrnoException, data: string) => {
				if (error) {
					return reject(error.message);
				}

				try {
					let instance = JSON.parse(data) as T;
					resolve(instance);
				}
				catch (error) {
					reject(error);
				}
			});
		});
	}

	export function readFile(filename: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			filesys.readFile(filename, 'UTF8', (error: NodeJS.ErrnoException, data: string) => {
				if (error) {
					return reject(error.message);
				}

				resolve(data);
			});
		});
	}

	export function stats(path: string): Promise<Stats> {
		return new Promise<fs.Stats>((resolve, reject) => {
			filesys.stat(path, (error: NodeJS.ErrnoException, stats: Stats) => {
				if (error) {
					return reject(error.message);
				}

				resolve(stats);
			});
		});
	}

	export function readdir(directory: string): Promise<Files> {
		let files: Files = {};

		return new Promise<{ [name: string]: fs.Stats }>((resolve, reject) => {
			filesys.readdir(directory, (err: NodeJS.ErrnoException, allFiles: string[]) => {
				if (err) {
					reject(err.message);
					return;
				}

				return allFiles.reduce((p: Promise<Files>, file: string) => {
					return p.then(() => {
						let stats = filesys.statSync(path.join(directory, file));

						files[file] = stats;

						return files;
					});
				}, Promise.resolve<Files>(files))
					.then(() => {
						resolve(files);
					});
			});
		});
	}
	
	export function writeJSON<T>(filename: string, obj: T): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			filesys.writeFile(filename, JSON.stringify(obj), (error: NodeJS.ErrnoException) => {
				if (error) {
					return reject(error.message);
				}

				resolve();
			});
		});
	}

	export function mkdir(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			filesys.mkdir(path, (error: NodeJS.ErrnoException) => {
				if (error && error.code != 'EEXIST') {
					return reject(error.message);
				}

				resolve();
			});
		});
	}

}

