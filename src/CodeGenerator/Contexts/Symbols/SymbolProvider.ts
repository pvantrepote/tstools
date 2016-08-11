import * as vscode from 'vscode';
import * as path from 'path';
import * as ts from 'typescript';
import { fs } from '../../../Tools/fs';
import { Symbol, SymbolType } from './Symbol';
import { TreeWalker } from '../TreeWalker';

type Symbols = { [type: string]: Symbol; };
type Files = { [file: string]: string; }

class SymbolProviderDictionary {
	public symbols: Symbols = {};
	public files: Files = {};
}

export class SymbolProvider implements vscode.Disposable {

	private _dictionary: SymbolProviderDictionary;
	private _watcher: vscode.FileSystemWatcher;

	private _configPath: string;
	private _dictionaryPath: string;
	private _initialized: boolean = false;
	private _extensionContext: vscode.ExtensionContext;

	private _walker: TreeWalker;

	// private _regex = /(?!.*)?(interface|class|namespace){1}\s*([A-Za-z0-9])*/g;
	// private _splitRegEx = /(^(interface|class|namespace))|(([A-Za-z0-9])*$)/g;

	private static _instance: SymbolProvider;
	public static get Instance(): SymbolProvider {
		if (!SymbolProvider._instance) {
			SymbolProvider._instance = new SymbolProvider();
		}

		return SymbolProvider._instance;
	}

	/**
	 * Dispose this object.
	 */
	public dispose(): any {
		this._initialized = false;
		this._dictionary = null;
		this._configPath = null;
		this._dictionaryPath = null;
		this._extensionContext = null;

		if (this._watcher) {
			this._watcher.dispose();
			this._watcher = null;
		}

		SymbolProvider._instance = null;
	}

	/**
	 * Init the provider 
	 * 
	 * @returns {Promise<SymbolProvider>}
	 */
	public init(context: vscode.ExtensionContext, forceInit?: boolean): Promise<SymbolProvider> {
		if (this._initialized || !vscode.workspace.rootPath) {
			return Promise.resolve(this);
		}

		if (!this._extensionContext) {
			this._extensionContext = context;

			// Add this to the context & create all watcher
			this._extensionContext.subscriptions.push(this);

			this._watcher = vscode.workspace.createFileSystemWatcher("**/*.ts", true, false, false);
			this._watcher.onDidChange(this.onDidChanged, this);
			this._watcher.onDidDelete(this.onDidDelete, this);
		}

		let cfgPath = path.join(vscode.workspace.rootPath, '.vscode');

		//
		if (forceInit) {
			return this.doInit(cfgPath);
		}
		else {
			// 
			return fs.stats(cfgPath)
				.then((stats: fs.Stats) => {
					return this.doInit(cfgPath);
				})
				.catch((error: any) => {
					console.error(error);
					return Promise.resolve(this);
				});
		}
	}

	/**
	 * Lookup a symbol 
	 * 
	 * @param {string} symbolToRequest The symbol to lookup
	 * @returns {Thenable<Symbol>} 
	 */
	public lookupSymbol(symbolToRequest: string): Thenable<Symbol> {
		return new Promise<Symbol>((resolve, reject) => {
			resolve(this._dictionary.symbols[symbolToRequest]);
		});
	}

	public lookupSymbolSync(symbolToRequest: string): Symbol {
		return this._dictionary.symbols[symbolToRequest];
	}

	public onDidChanged(uri: vscode.Uri) {
		this.init(this._extensionContext, true)
			.then(() => {
				// If not initialized, just return
				if (!this._initialized) {
					return;
				}

				let relativePath = path.relative(vscode.workspace.rootPath, uri.fsPath);

				// Filter out *.d.ts if we have a matching .ts file
				if (relativePath.endsWith(".d.ts")) {
					let toLookUp = relativePath.substr(0, relativePath.length - 5) + ".ts";
					if (this._dictionary.files[toLookUp]) {
						return;
					}
				}

				return this.updateDictionaryEntry(uri.fsPath, relativePath)
					.then(() => {
						return this.save();
					})
			});
	}

	public onDidDelete(uri: vscode.Uri) {

		this.init(this._extensionContext)
			.then(() => {
				// If not initialized, just return
				if (!this._initialized) {
					return;
				}

				// Remove everything related to this file
				let relativePath = path.relative(vscode.workspace.rootPath, uri.fsPath);
				if (this._dictionary.files[relativePath]) {
					delete this._dictionary.files[relativePath];

					//
					let extension = path.parse(relativePath).ext;
					let symbolPath = relativePath.substr(0, relativePath.length - extension.length);

					// Delete the related symbol
					for (let key in this._dictionary.symbols) {
						if (this._dictionary.symbols[key].relativePath == symbolPath) {
							delete this._dictionary.symbols[key];
						}
					}
				}

				return this.save();
			})

	}

	private doInit(cfgPath: string): Promise<SymbolProvider> {
		//
		let dictionaryPath = path.join(cfgPath, 'symbols.json');

		// 1st read the JSON
		return fs.readJSON<SymbolProviderDictionary>(dictionaryPath)
			.then((dictionary: SymbolProviderDictionary) => {
				this._dictionary = dictionary;
			})
			.catch((error) => {
				// Got an error
				console.error(error);

				// Create a brand new dictionary
				this._dictionary = new SymbolProviderDictionary();

				// Create the VSCode folder
				return fs.mkdir(cfgPath);
			})
			.then(() => {
				this._configPath = cfgPath;
				this._dictionaryPath = path.join(cfgPath, 'symbols.json');
				this._walker = new TreeWalker(false);

				return this.createOrUpdateDictionary();
			})
			.then(() => {
				this._initialized = true;
				return this;
			});
	}

	/**
	 * Create the dictionary
	 * 
	 * @protected
	 * @returns {Thenable<SymbolProvider>}
	 */
	protected createOrUpdateDictionary(): Thenable<SymbolProvider> {
		let rootPath = vscode.workspace.rootPath;

		// 
		let processedFile = new Array<string>();

		return this.listFile(rootPath, (filepath: string, stats: fs.Stats) => {
			let relativePath = path.relative(rootPath, filepath);
			processedFile.push(relativePath);

			if (this._dictionary.files[relativePath]) {
				return this.updateDictionaryEntry(filepath, relativePath, stats);
			}
			else {
				return this.addToDictionary(filepath, relativePath, stats);
			}
		})
			.then(() => {
				// Remove deleted files
				for (let file in this._dictionary.files) {
					if (processedFile.indexOf(file) != -1) {
						continue;
					}

					// Remoove the file
					delete this._dictionary[file];

					// Delete the related symbol
					for (let key in this._dictionary.symbols) {
						if (this._dictionary.symbols[key].relativePath == file) {
							delete this._dictionary.symbols[key];
						}
					}
				}
			})
			.then(() => {
				return this.save();
			});

	}

	protected listFile(folder: string, fileProcessor: (filepath: string, stats: fs.Stats) => Promise<void>): Promise<void> {

		return fs.readdir(folder)
			.then((files: fs.Files) => {
				return Object.keys(files).reduce((p: Promise<void>, key: string) => {
					return p.then(() => {
						let stats: fs.Stats = files[key];

						if (stats.isDirectory()) {
							return this.listFile(path.join(folder, key), fileProcessor)
						}
						else if (stats.isFile() && key.endsWith(".ts")) {

							// Filter out *.d.ts if we have a matching .ts file
							if (key.endsWith(".d.ts")) {
								let toLookUp = key.substr(0, key.length - 5) + ".ts";
								if (files[toLookUp]) {
									return;
								}
							}

							return fileProcessor(path.join(folder, key), stats);
						}

						return;
					});
				}, Promise.resolve());

			});
	}

	protected save(): Promise<SymbolProvider> {
		return fs.mkdir(this._configPath)
			.then(() => {
				return fs.writeJSON(this._dictionaryPath, this._dictionary);
			})
			.then(() => {
				return this;
			});
	}

	protected processNode(walker: TreeWalker, sourceFile: ts.SourceFile, filepath: string, relativePath: string, node: ts.Node, parentName?: string) {
		if (node.kind == ts.SyntaxKind.ModuleDeclaration) {
			let name = walker.getTextForNode(node);
			if (parentName) {
				name = parentName + "." + name;
			}
			let block = walker.getModuleBlock(node as ts.ModuleDeclaration);

			return this.processNode(walker, sourceFile, filepath, relativePath, block, name);
		}

		walker.walk(node, (child: ts.Node) => {

			if ((child.kind == ts.SyntaxKind.ClassDeclaration) ||
				(child.kind == ts.SyntaxKind.InterfaceDeclaration)) {
				let symbol = walker.getTextForNode(child);
				let type: SymbolType = (child.kind == ts.SyntaxKind.ClassDeclaration) ? SymbolType.isClass : SymbolType.isInterface;

				if (parentName) {
					this._dictionary.symbols[parentName + "." + symbol] = new Symbol(type, relativePath, true);
				}
				else {
					this._dictionary.symbols[symbol] = new Symbol(type, relativePath, false);
				}
			}
			else if (child.kind == ts.SyntaxKind.ModuleDeclaration) {
				this.processNode(walker, sourceFile, filepath, relativePath, child, parentName);
			}

		});
	}

	protected processFile(filepath: string, relativePath: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {

			// Load the file
			let sourceFile = this._walker.getSourceFile(filepath);
			if (!sourceFile) {
				return reject();
			}

			this.processNode(this._walker, sourceFile, filepath, relativePath, sourceFile)

			resolve();

		});
	}

	protected updateDictionaryEntry(filepath: string, relativePath: string, stats?: fs.Stats): Promise<void> {
		if (stats) {
			return this.doUpdate(filepath, relativePath, stats);
		}

		return fs.stats(filepath)
			.then((stats: fs.Stats) => {
				return this.doUpdate(filepath, relativePath, stats);
			});
	}

	protected doUpdate(filepath: string, relativePath: string, stats: fs.Stats): Promise<void> {
		let dateStr = stats.mtime.toISOString();

		// Somthing Changed?
		if (this._dictionary.files[relativePath] == dateStr) {
			return;
		}

		this._dictionary.files[relativePath] = dateStr;

		// 
		let extension = path.parse(relativePath).ext;
		let symbolPath = relativePath.substr(0, relativePath.length - extension.length);

		// Remove all elements from the processing file
		for (let key in this._dictionary.symbols) {
			if (this._dictionary.symbols[key].relativePath == symbolPath) {
				delete this._dictionary.symbols[key];
			}
		}

		// Reprocess the file
		return this.processFile(filepath, relativePath);
	}

	protected addToDictionary(filepath: string, relativePath: string, stats?: fs.Stats): Promise<void> {
		// Load the file
		return this.processFile(filepath, relativePath)
			.then(() => {
				if (stats) {
					return stats;
				}
				
				return fs.stats(filepath);
			})
			.then((stats: fs.Stats) => {
				this._dictionary.files[relativePath] = stats.mtime.toISOString();
			})
			.catch((reason) => {
				console.error(reason);
			});
	}
}