import * as vscode from 'vscode';
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { SymbolProvider } from './Symbols/SymbolProvider';
import { Symbol } from './Symbols/Symbol';


interface CompilerOptions {
	module: string;
	target: string;
}

interface TSConfig {
	compilerOptions: CompilerOptions;
}

export class ResolvedSymbol extends Symbol {
	symbol: string;

	constructor(value: string, symbol: Symbol) {
		super();

		this.hasNamespace = symbol.hasNamespace;
		this.moduleName = symbol.moduleName;
		this.relativePath = symbol.relativePath;
		this.symbol = value;
		this.type = symbol.type;
	}
}

export class TreeWalker {

	private _host: ts.CompilerHost;
	public get host(): ts.CompilerHost {
        return this._host;
	};
   	public set host(value: ts.CompilerHost) {
        this._host = value;
    };

	private _options: ts.CompilerOptions;
	public get options(): ts.CompilerOptions {
        return this._options;
	};
   	public set options(value: ts.CompilerOptions) {
        this._options = value;
    };

	private _cachedFiles: { [name: string]: ts.SourceFile; } = {}
	private _cacheEnabled: boolean;

	constructor(cacheEnabled?: boolean) {
		this._options = {
			moduleResolution: ts.ModuleResolutionKind.Classic,
			target: ts.ScriptTarget.ES5
		};

		// Load the tsconfig.json
		let tsPath = path.join(vscode.workspace.rootPath, 'tsconfig.json');
		if (fs.existsSync(tsPath)) {
			let tsConfig: TSConfig = null;

			try {
				tsConfig = require(tsPath) as TSConfig;
			}
			catch (error) {
				console.error(error);
			}

			if ((tsConfig) && (tsConfig.compilerOptions.target)) {
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

		this._host = ts.createCompilerHost(this._options, true);
		this._cacheEnabled = (cacheEnabled && (cacheEnabled == true));
	}

	public newLine(): string {
		return this._host.getNewLine();
	}

	public walk(node: ts.Node, callback: (node: ts.Node) => any) {
		ts.forEachChild(node, (child: ts.Node) => {
			return callback(child);
		});

	}

	public getNodeForSymbol(sourceFile: ts.SourceFile, symbol: ResolvedSymbol): ts.Node {
		let currentNode: ts.Node = sourceFile;
		let symbolValue = symbol.symbol;

		// lookup the npde for the symbol
		let foundNode: ts.Node = null;
		let found: boolean = false;
		while ((!found) && (currentNode)) {
			foundNode = ts.forEachChild(currentNode, (child: ts.Node) => {
				let childName = this.getTextForNode(child);
				if (childName == symbolValue) {
					found = true;
					return child;
				}
				if ((symbolValue.startsWith(childName)) &&
					(child.kind == ts.SyntaxKind.ModuleDeclaration) &&
					(symbol.hasNamespace)) {
					symbolValue = symbolValue.substr(childName.length + 1);
					currentNode = this.getModuleBlock(child as ts.ModuleDeclaration);
					return currentNode;
				}
			});
		}

		return foundNode;
	}

	public resolveSymbol(symbolStr: string): ResolvedSymbol {

		let symbol = SymbolProvider.Instance.lookupSymbolSync(symbolStr);
		if (!symbol) {
			return null;
		}

		return new ResolvedSymbol(symbolStr, symbol);
	}


	/**
	 * Resolve symbol for a specified node
	 * 
	 * @param {ts.SourceFile} sourceFile The source file of the node
	 * @param {ts.Node} node The node
	 * @returns {Thenable<ResolvedSymbol>}
	 */
	public resolveSymbolForNode(sourceFile: ts.SourceFile, node: ts.Node): ResolvedSymbol {

		let toResolve: string;

		let expression = this.getParentNodeOfKind<ts.ExpressionWithTypeArguments | ts.TypeReferenceNode>(sourceFile, node, [ts.SyntaxKind.ExpressionWithTypeArguments, ts.SyntaxKind.TypeReference]);
		if (!expression) {
			toResolve = this.getTextForNode(node);
		}
		else {
			toResolve = this.getTextForNode(expression);
		}

		// Get the value of the expression
		if (!toResolve) {
			return null;
		}

		let symbol = SymbolProvider.Instance.lookupSymbolSync(toResolve);
		if (!symbol) {
			return null;
		}

		return new ResolvedSymbol(toResolve, symbol);
	}

	public getSourceFileForSymbol(symbol: Symbol) {
		let filepath = path.join(vscode.workspace.rootPath, symbol.relativePath) + ".ts";
		return this.getSourceFile(filepath);
	}

	/**
	 *  Get a parent of specified node of a specific type
	 * 
	 * @template T
	 * @param {ts.SourceFile} sourceFile The source file
	 * @param {ts.Node} node The node
	 * @param {ts.SyntaxKind[]} kinds Kinds of nodes we are looking for
	 * @param {ts.Node} [currentNode]
	 * @param {() => ts.Node} [lookupParent]
	 * @returns {T} Return thre first found node or null
	 */
	public getParentNodeOfKind<T extends ts.Node>(sourceFile: ts.SourceFile, node: ts.Node, kinds: ts.SyntaxKind[], currentNode?: ts.Node): T {

		if (!currentNode) {
			currentNode = node;
		}

		if (currentNode.parent) {
			if (kinds.indexOf(currentNode.parent.kind) != -1) {
				return currentNode.parent as T;
			}

			return this.getParentNodeOfKind<T>(sourceFile, node, kinds, currentNode.parent);
		}

		return null;
	}

	/**
	 * Get the source file for a specified file
	 * 
	 * @param {string} path The path
	 * @param {string} sourceCode The source code 
	 * @returns {ts.SourceFile} Return the source file or null if not found
	 */
	public getSourceFile(path: string, sourceCode?: string): ts.SourceFile {
		let sourceFile: ts.SourceFile = this._cachedFiles[path];

		if (!sourceFile) {
			if (sourceCode) {
				sourceFile = ts.createSourceFile(path, sourceCode, this._options.target, true);
			}
			else {
				sourceFile = this._host.getSourceFile(path, this._options.target, (error) => {
					console.error(error);
				});
			}

			if (this._cacheEnabled) {
				this._cachedFiles[path] = sourceFile;
			}
		}

		return sourceFile;
	}

	/**
	 * Find the class or property declaration node that contains the given node
	 * 
	 * @param {ts.SourceFile} sourceFile The source file
	 * @param {ts.Node} node The node
	 * @param {ts.Node} [currentNode]
	 * @param {() => ts.Node} [lookupParent]
	 * @returns {ts.Declaration} Return the declaration node or null if not found
	 */
	public findDeclarationForNode(sourceFile: ts.SourceFile, node: ts.Node, currentNode?: ts.Node, lookupParent?: () => ts.Node): ts.Declaration {
		return this.getParentNodeOfKind<ts.Declaration>(sourceFile, node, [ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.ClassDeclaration, ts.SyntaxKind.InterfaceDeclaration]);
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

	public getModuleBlock(module: ts.ModuleDeclaration): ts.ModuleBlock {
		let block = (module as ts.ModuleDeclaration).body;
		while ((block.kind != ts.SyntaxKind.ModuleBlock) && block) {
			block = (block as ts.ModuleDeclaration).body;
		}

		return block as ts.ModuleBlock;
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

		let elements = text.split('.');
		if (elements.length > 1) {
			// Namepace included, lookup for it first

		}

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
	public getNodeAtOffsetOfKinds<T extends ts.Node>(sourceFile: ts.SourceFile, offset: number, kinds: Array<ts.SyntaxKind>, currentNode?: ts.Node): T {

		if (!currentNode) {
			currentNode = sourceFile;
		}

		// Get all children
		if ((currentNode.pos > offset) || (currentNode.end < offset)) {
			return null;
		}

		if (kinds.indexOf(currentNode.kind) != -1) {
			return currentNode as T;
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

		switch (node.kind) {
			case ts.SyntaxKind.ExpressionWithTypeArguments:
				let expression = node as ts.ExpressionWithTypeArguments;
				if (expression.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
					return this.getTextForNode(expression.expression as ts.PropertyAccessExpression);
				}
				else {
					node = expression.expression;
				}
				break;
			case ts.SyntaxKind.PropertyAccessExpression:
				let name = this.getTextForNode((node as ts.PropertyAccessExpression).expression);
				return name + '.' + this.getTextForNode((node as ts.PropertyAccessExpression).name);

			case ts.SyntaxKind.ModuleDeclaration:
				let childName = this.getTextForNode((node as ts.ModuleDeclaration).body);
				return (node as ts.ModuleDeclaration).name.text + ((childName) ? ('.' + childName) : '');

			case ts.SyntaxKind.TypeReference:
				return this.getTextForNode((node as ts.TypeReferenceNode).typeName);
			case ts.SyntaxKind.QualifiedName:
				let left = this.getTextForNode((node as ts.QualifiedName).left);
				let right = this.getTextForNode((node as ts.QualifiedName).right);
				return left + "." + right;

			default:
				break;
		}


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