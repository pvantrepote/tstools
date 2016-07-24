import * as vscode from 'vscode';
import * as path from 'path';
import * as ts from 'typescript';
import { fsts as fs, Stats } from '../../../Tools/fs';
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

	private _walker: TreeWalker = new TreeWalker(false);

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
	public init(context: vscode.ExtensionContext): Promise<SymbolProvider> {
		if (this._initialized) {
			return Promise.resolve(this);
		}

		//
		this._configPath = path.join(vscode.workspace.rootPath, '.tstools');
		this._dictionaryPath = path.join(this._configPath, '.symbols.json');

		// Add this to the context
		context.subscriptions.push(this);

		// 1st read the JSON
		return fs.readJSON<SymbolProviderDictionary>(this._dictionaryPath)
			.then((dictionary: SymbolProviderDictionary) => {
				this._dictionary = dictionary;

				// Update the dictionary
				return this.createOrUpdateDictionary();
			})
			.catch((error) => {
				// Got an error
				console.error(error);

				// re-create the dictionary
				this._dictionary = new SymbolProviderDictionary();
				return this.createOrUpdateDictionary();
			})
			.then(() => {
				this._watcher = vscode.workspace.createFileSystemWatcher("**/*.ts", true, false, false);

				this._watcher.onDidChange(this.onDidChanged, this);
				this._watcher.onDidDelete(this.onDidDelete, this);

				this._initialized = true;
				return this;
			});
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
		let relativePath = path.relative(vscode.workspace.rootPath, uri.fsPath);

		return this.updateDictionaryEntry(uri.fsPath, relativePath)
			.then(() => {
				return this.save();
			});
	}

	public onDidDelete(uri: vscode.Uri) {
		let relativePath = path.relative(vscode.workspace.rootPath, uri.fsPath);
		if (this._dictionary.files[relativePath]) {
			delete this._dictionary.files[relativePath];

			// Delete the related symbol
			for (let key in this._dictionary.symbols) {
				if (this._dictionary.symbols[key].relativePath == relativePath) {
					delete this._dictionary.symbols[key];
				}
			}
		}

		return this.save();
	}

	/**
	 * Create the dictionary
	 * 
	 * @protected
	 * @returns {Thenable<SymbolProvider>}
	 */
	protected createOrUpdateDictionary(): Thenable<SymbolProvider> {
		let rootPath = vscode.workspace.rootPath;

		// Find all ts files
		return vscode.workspace.findFiles("**/*.ts", "**/node_modules/**")
			.then((uris: Array<vscode.Uri>) => {
				// 
				let processedFile = new Array<string>();

				// For all files, 
				return uris.reduce((p: Promise<void>, uri: vscode.Uri) => {
					return p.then(() => {
						let relativePath = path.relative(rootPath, uri.fsPath);
						processedFile.push(relativePath);

						if (this._dictionary.files[relativePath]) {
							return this.updateDictionaryEntry(uri.fsPath, relativePath);
						}
						else {
							return this.addToDictionary(uri.fsPath, relativePath);
						}
					});
				}, Promise.resolve())
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

					});
			})
			.then(() => {
				return this.save();
			})
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

	protected updateDictionaryEntry(filepath: string, relativePath: string): Promise<void> {
		return fs.stats(filepath)
			.then((stats: Stats) => {
				let dateStr = stats.mtime.toISOString();

				// Somthing Changed?
				if (this._dictionary.files[relativePath] != dateStr) {
					this._dictionary.files[relativePath] = dateStr;

					// Remove all elements from the processing file
					for (let key in this._dictionary.symbols) {
						if (this._dictionary.symbols[key].relativePath == relativePath) {
							delete this._dictionary.symbols[key];
						}
					}

					// Reprocess the file
					return this.processFile(filepath, relativePath);
				}
			});
	}

	protected addToDictionary(filepath: string, relativePath: string): Promise<void> {
		// Load the file
		return this.processFile(filepath, relativePath)
			.then(() => {
				return fs.stats(filepath);
			})
			.then((stats: Stats) => {
				this._dictionary.files[relativePath] = stats.mtime.toISOString();
			})
			.catch((reason) => {
				console.error(reason);
			});
	}
}