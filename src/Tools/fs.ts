import * as fs from 'fs';

export interface Stats extends fs.Stats {}

export class fsts {

	public static readJSON<T>(filename: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			fs.readFile(filename, 'UTF8', (error: NodeJS.ErrnoException, data: string) => {
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

	public static readFile(filename: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			fs.readFile(filename, 'UTF8', (error: NodeJS.ErrnoException, data: string) => {
				if (error) {
					return reject(error.message);
				}

				resolve(data);
			});
		});
	}

	public static stats(path: string): Promise<Stats> {
		return new Promise<fs.Stats>((resolve, reject) => {
			fs.stat(path, (error: NodeJS.ErrnoException, stats: Stats) => {
				if (error) {
					return reject(error.message);
				}

				resolve(stats);
			});
		});
	}

	public static writeJSON<T>(filename: string, obj: T): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			fs.writeFile(filename, JSON.stringify(obj), (error: NodeJS.ErrnoException) => {
				if (error) {
					return reject(error.message);
				}

				resolve();
			});
		});
	}

	public static mkdir(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.mkdir(path, (error: NodeJS.ErrnoException) => {
				if (error && error.code != 'EEXIST') {
					return reject(error.message);
				}

				resolve();
			});
		});
	}

}