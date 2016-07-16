import * as vscode from 'vscode';
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

interface CompilerOptions {
	module: string;
	target: string;
}

interface TSConfig {
	compilerOptions: CompilerOptions;
}

export class TreeWalker {

	private _host: ts.CompilerHost;
	private _options: ts.CompilerOptions;
	private _cachedFiles: { [name: string]: ts.SourceFile; } = {}

	constructor() {
		this._options = {
			moduleResolution: ts.ModuleResolutionKind.Classic,
			target: ts.ScriptTarget.ES5
		};

		// Load the tsconfig.json
		let tsPath = path.join(vscode.workspace.rootPath, 'tsconfig.json');
		if (fs.existsSync(tsPath)) {
			let tsConfig = require(tsPath) as TSConfig;
			if (tsConfig.compilerOptions.target) {
				switch (tsConfig.compilerOptions.target) {
					case 'es6':
						this._options.target = ts.ScriptTarget.ES6;
						break;
					case 'es5':
						this._options.target = ts.ScriptTarget.ES5;
						break;
					default:
					case 'es3':
						this._options.target = ts.ScriptTarget.ES3;
						break;
				}
			}			
		}

		this._host = ts.createCompilerHost(this._options, null);
	}

	public newLine(): string {
		return this._host.getNewLine();
	}

	/**
	 * Get the source file for a specified file
	 * 
	 * @param {string} path The path
	 * @param {string} sourceCode The source code 
	 * @returns {ts.SourceFile} Return the source file or null if not found
	 */
	public getSourceFile(path: string, sourceCode?: string): ts.SourceFile {
		let sourceFile: ts.SourceFile;

		if (!this._cachedFiles[path]) {
			if (sourceCode) {
				sourceFile = ts.createSourceFile(path, sourceCode, this._options.target);
			}
			else {
				sourceFile = this._host.getSourceFile(path, this._options.target, (error) => {
					console.error(error);
				});
			}


			this._cachedFiles[path] = sourceFile;
		}

		return this._cachedFiles[path];
	}

	/**
	 * Find the declaration node that contains the given node
	 * 
	 * @param {ts.SourceFile} sourceFile The source file
	 * @param {ts.Node} node The node
	 * @param {ts.Node} [currentNode]
	 * @param {() => ts.Node} [lookupParent]
	 * @returns {ts.Declaration} Return the declaration node or null if not found
	 */
	public findDeclarationForNode(sourceFile: ts.SourceFile, node: ts.Node, currentNode?: ts.Node, lookupParent?: () => ts.Node): ts.Declaration {

		if (!currentNode) {
			currentNode = sourceFile;
		}

		let found = ts.forEachChild(currentNode, (child: ts.Node) => {
			if (child == node) {
				if ((currentNode.kind == ts.SyntaxKind.PropertyDeclaration) ||
					(currentNode.kind == ts.SyntaxKind.ClassDeclaration)) {
					return currentNode;
				}

				let parent = lookupParent();
				return parent
			}

			let parentNode = this.findDeclarationForNode(sourceFile, node, child, (): ts.Node => {
				if ((currentNode.kind == ts.SyntaxKind.PropertyDeclaration) ||
					(currentNode.kind == ts.SyntaxKind.ClassDeclaration)) {
					return currentNode;
				}

				return (lookupParent) ? lookupParent() : null;
			});

			if (parentNode) {
				return parentNode;
			}
		});

		return found as ts.Declaration;
	}

	/**
	 * Find property declaration (class or property) at a specified offset
	 * 
	 * @param {ts.SourceFile} sourceFile The source file tree
	 * @param {number} offset The offset
	 * @returns {ts.Declaration} Return the declaration or null if not found
	 */
	public findPropertyDeclarationAtOffset(sourceFile: ts.SourceFile, offset: number): ts.PropertyDeclaration {

		// Find the class
		let declarations = this.getAllNodesOfType<ts.PropertyDeclaration>(sourceFile, ts.SyntaxKind.PropertyDeclaration, (declaration: ts.PropertyDeclaration) => {
			return ((declaration.pos <= offset) && (offset <= declaration.end));
		});

		//
		if ((!declarations) || (!declarations.length)) {
			console.warn("Class not found at offset '%d'", offset);
			return null;
		}

		return declarations[0];
	}

	/**
	 * Resolve type
	 * 
	 * @param {ts.SourceFile} sourceFile sourceFile The source file tree
	 * @param {string} type The type we are trying to resolve 
	 * @returns {ts.SourceFile} Return the source file that contains the type or null if not found.
	 */
	public resolveType(sourceFile: ts.SourceFile, type: string): ts.SourceFile {

		// Get all imports
		let foundImport = this.getAllNodesOfType<ts.ImportDeclaration>(sourceFile, ts.SyntaxKind.ImportDeclaration, (importDeclaration: ts.ImportDeclaration) => {
			let specifiers = this.getAllNodesOfType<ts.ImportSpecifier>(sourceFile, ts.SyntaxKind.ImportSpecifier, (specifier: ts.ImportSpecifier) => {
				let name = this.getTextForNode(specifier);
				return (name == type);
			}, importDeclaration);

			return (specifiers.length > 0);
		});

		// For now we support only explicit specifier 
		if (!foundImport || !foundImport.length) {
			console.warn("Import not found for type '%s'.", type);
			return null;
		}

		// Resolve the module
		let importDeclaration = foundImport[0];
		let moduleName = this.getTextForNode(importDeclaration.moduleSpecifier);

		let resolvedModule = ts.resolveModuleName(moduleName, sourceFile.fileName, this._options, this._host);
		if (!resolvedModule || !resolvedModule.resolvedModule) {
			console.warn("Module '%s' not found.", moduleName);
			return null;
		}

		return this.getSourceFile(resolvedModule.resolvedModule.resolvedFileName);
	}

	/**
	 * Get all node of a kind at the same level
	 * 
	 * @template T
	 * @param {ts.SourceFile} sourceFile The source file tree
	 * @param {ts.SyntaxKind} kind The kind of the node we are looking for
	 * @param {(node: T) => boolean} filter The filter callback to use during iteration
	 * @param {ts.Node} [currentNode]
	 * @param {Array<T>} [foundNodes] 
	 * @returns {Array<T>} Return an array of nodes
	 */
	public getAllNodesOfType<T extends ts.Node>(sourceFile: ts.SourceFile, kind: ts.SyntaxKind | Array<ts.SyntaxKind>, filter?: (node: T) => boolean, currentNode?: ts.Node, foundNodes?: Array<T>): Array<T> {
		if (!foundNodes) {
			foundNodes = new Array<T>();
		}
		if (!currentNode) {
			currentNode = sourceFile;
		}

		let isArray = (kind["length"] != undefined);
		let isRightKing: boolean;
		ts.forEachChild(currentNode, (child: ts.Node) => {
			if (isArray) {
				isRightKing = ((kind as Array<ts.SyntaxKind>).indexOf(child.kind) != -1);
			}
			else {
				isRightKing = (child.kind == kind);
			}

			if (isRightKing) {
				if ((!filter) || (filter(child as T))) {
					foundNodes.push(child as T);
				}
			}
			else if (foundNodes.length == 0) {
				this.getAllNodesOfType<T>(sourceFile, kind, filter, child, foundNodes);
			}
		});

		return foundNodes;
	}

	/**
	 * Find node matching a specified text
	 * 
	 * @template T
	 * @param {ts.SourceFile} sourceFile The source file to look into
	 * @param {string} text The text to look for
	 * @param {ts.SyntaxKind} [king] The kind of node we are looking for
	 * @param {ts.Node} [currentNode] The current node
	 * @returns {ts.Node} Return the found node or null if not found.
	 */
	public findNodeWithText<T extends ts.Node>(sourceFile: ts.SourceFile, text: string, kind?: ts.SyntaxKind | ts.SyntaxKind[], currentNode?: ts.Node): T {

		if (!currentNode) {
			currentNode = sourceFile;
		}
		else {
			let kindMatching: boolean = true;
			if (kind) {
				if (kind["length"]) {
					kindMatching = ((kind as ts.SyntaxKind[]).indexOf(currentNode.kind) != -1);
				}
				else {
					kindMatching = (currentNode.kind == kind);
				}
			}

			let nodeName = this.getTextForNode(currentNode);
			if (kindMatching && nodeName && (nodeName == text)) {
				return currentNode as T;
			}
		}

		let foundNode: ts.Node = ts.forEachChild(currentNode, (child: ts.Node) => {
			return this.findNodeWithText(sourceFile, text, kind, child);
		});

		return foundNode as T;
	}



	/**
	 * Get node at a specified offset
	 * 
	 * @template T
	 * @param {ts.SourceFile} sourceFile The source file to look into
	 * @param {number} offset The offset of the node we are looking for
	 * @param {ts.Node} [currentNode]
	 * @returns {T} The the node or null if not found
	 */
	public getNodeAtOffset<T extends ts.Node>(sourceFile: ts.SourceFile, offset: number, currentNode?: ts.Node): T {

		if (!currentNode) {
			currentNode = sourceFile;
		}

		// Get all children
		if ((currentNode.pos > offset) || (currentNode.end < offset)) {
			return null;
		}

		let foundNode = ts.forEachChild(currentNode, (child: ts.Node) => {
			return this.getNodeAtOffset(sourceFile, offset, child);
		});
		if (!foundNode) {
			foundNode = currentNode;
		}

		return foundNode as T;
	}

	/**
	 * Get the text for a specified node
	 * 
	 * @param {ts.Node} node The node
	 * @returns {string}
	 */
	public getTextForNode(node: ts.Node): string {
		if (node["name"]) {
			if (node["name"]["text"]) {
				return node["name"]["text"]
			}
			return node["name"];
		}

		if (node["text"]) {
			return node["text"];
		}

		return null;
	}
}