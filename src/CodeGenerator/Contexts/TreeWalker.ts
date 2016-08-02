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
	refOrImport: ts.ImportDeclaration | ts.FileReference;

	constructor(value: string, symbol: Symbol, refOrImport?: ts.ImportDeclaration | ts.FileReference) {
		super();

		this.hasNamespace = symbol.hasNamespace;
		this.moduleName = symbol.moduleName;
		this.relativePath = symbol.relativePath;
		this.symbol = value;
		this.type = symbol.type;
		this.refOrImport = refOrImport;
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

	public get newLine(): string {
		return this._host.getNewLine();
	}
	
	private _cachedFiles: { [name: string]: ts.SourceFile; } = {}
	private _cacheEnabled: boolean;

	constructor(cacheEnabled?: boolean) {
		this._options = {
			moduleResolution: ts.ModuleResolutionKind.Classic,
			target: ts.ScriptTarget.ES5
		};

		// Load the tsconfig.json
		try {
			let tsPath = path.join(vscode.workspace.rootPath, 'tsconfig.json');
			let stats = fs.statSync(tsPath);
			if (stats) {
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
		}
		catch (error) {

		}

		this._host = ts.createCompilerHost(this._options, true);
		this._cacheEnabled = (cacheEnabled && (cacheEnabled == true));
	}

	/**
	 * Iterate through the tree 
	 * 
	 * @param {ts.Node} node the root node
	 * @param {(node: ts.Node) => any} callback
	 */
	public walk(rootNode: ts.Node, callback: (node: ts.Node) => any) {
		ts.forEachChild(rootNode, (child: ts.Node) => {
			return callback(child);
		});
	}

	/**
	 * Find the node for the given symbol
	 * 
	 * @param {ts.SourceFile} sourceFile The source file that contains the node
	 * @param {ResolvedSymbol} symbol The symbol 
	 * @returns {ts.Node}
	 */
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

	/**
	 * Resolve symbol for a given string 
	 * 
	 * @param {string} symbolStr The symbol to resolve
	 * @returns {ResolvedSymbol}
	 */
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

		// Get the expression for the node
		let expression = this.getParentNodeOfKind<ts.ExpressionWithTypeArguments | ts.TypeReferenceNode | ts.PropertyAccessExpression>(sourceFile, node, [ts.SyntaxKind.ExpressionWithTypeArguments, ts.SyntaxKind.TypeReference, ts.SyntaxKind.PropertyAccessExpression]);
		if (!expression) {
			toResolve = this.getTextForNode(node);
		}
		else {
			toResolve = this.getTextForNode(expression);
		}

		// Anything to resolve?
		if (!toResolve) {
			return null;
		}

		// Find the symbol
		let symbol = this.findSymbol(sourceFile, toResolve);
		if (!symbol && expression && (node != expression)) {
			// No symbol found using the expression, try with the given node.
			toResolve = this.getTextForNode(node);

			if (!toResolve) {
				symbol = this.findSymbol(sourceFile, toResolve);
			}
		}

		return symbol;
	}
	
	/**
	 * Get source file for a given symbol
	 * 
	 * @param {Symbol} symbol The symbol
	 * @returns {ts.SourceFile} Return the source file or null if not found
	 */
	public getSourceFileForSymbol(symbol: Symbol) : ts.SourceFile {
		let filepath = path.join(vscode.workspace.rootPath, symbol.relativePath) + ".ts";
		return this.getSourceFile(filepath);
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
	 * @returns {ts.Declaration} Return the declaration node or null if not found
	 */
	public findDeclarationForNode(sourceFile: ts.SourceFile, node: ts.Node): ts.Declaration {
		return this.getParentNodeOfKind<ts.Declaration>(sourceFile, node, [ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.ClassDeclaration, ts.SyntaxKind.InterfaceDeclaration]);
	}

	/**
	 * Return the module block
	 * 
	 * @param {ts.ModuleDeclaration} module The module
	 * @returns {ts.ModuleBlock} The mobulde body or null if not found.
	 */
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

	/**
	 * Find a symbol user in a source file  
	 * 
	 * @private
	 * @param {ts.SourceFile} sourceFile The source file
	 * @param {string} symbolToFind The symbol to find
	 * @returns {ResolvedSymbol} Return a ResolvedSymbol or null is not found
	 */
	private findSymbol(sourceFile: ts.SourceFile, symbolToFind: string) : ResolvedSymbol {
		// Ok, now lookup 
		let symbol = SymbolProvider.Instance.lookupSymbolSync(symbolToFind);

		//
		if (symbol && symbol.hasNamespace) {
			let parsedPath = path.parse(sourceFile.fileName);
			let filepath = path.join(vscode.workspace.rootPath, symbol.relativePath);
			let moduleDirectory = './' + path.relative(parsedPath.dir, filepath);

			let foundRef = sourceFile.referencedFiles.find((ref: ts.FileReference) => {
				return (ref.fileName == moduleDirectory);
			});

			return new ResolvedSymbol(symbolToFind, symbol, foundRef);
		}

		// Lookup for the import
		let importDeclaration = this.getImportForType(sourceFile, symbolToFind);
		if (!symbol && importDeclaration) {
			symbolToFind = importDeclaration.type;
			symbol = SymbolProvider.Instance.lookupSymbolSync(symbolToFind);
		}

		if (!symbol) {
			return null;
		}

		return new ResolvedSymbol(symbolToFind, symbol, (importDeclaration) ? importDeclaration.importDeclaration : undefined);
	}

	/**
	 *  Get a parent of specified node of a specific type
	 * 
	 * @private
	 * @template T
	 * @param {ts.SourceFile} sourceFile The source file
	 * @param {ts.Node} node The node
	 * @param {ts.SyntaxKind[]} kinds Kinds of nodes we are looking for
	 * @param {ts.Node} [currentNode]
	 * @param {() => ts.Node} [lookupParent]
	 * @returns {T} Return thre first found node or null
	 */
	private getParentNodeOfKind<T extends ts.Node>(sourceFile: ts.SourceFile, node: ts.Node, kinds: ts.SyntaxKind[], currentNode?: ts.Node): T {

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
	 * Lookup import in a given source file for a given type 
	 * 
	 * @private
	 * @param {ts.SourceFile} sourceFile The source file
	 * @param {string} type The type
	 * @returns {{ importDeclaration: ts.ImportDeclaration, type: string }}
	 */
	private getImportForType(sourceFile: ts.SourceFile, type: string): { importDeclaration: ts.ImportDeclaration, type: string } {

		// Get all imports
		let foundImport = this.getAllNodesOfType<ts.ImportDeclaration>(sourceFile, ts.SyntaxKind.ImportDeclaration, (importDeclaration: ts.ImportDeclaration) => {
			let importClause = importDeclaration.importClause;
			if (!importClause || !importClause.namedBindings) {
				return false;
			}

			if (importClause.namedBindings.kind == ts.SyntaxKind.NamedImports) {
				let namedImports = importClause.namedBindings as ts.NamedImports;

				let specifier = ts.forEachChild<ts.ImportSpecifier>(namedImports, (child: ts.ImportSpecifier) => {
					let name = this.getTextForNode(child);
					return (name == type) ? child : undefined;
				});

				return (specifier != undefined);
			}

			let nameSpaceImports = importClause.namedBindings as ts.NamespaceImport;
			let name = this.getTextForNode(nameSpaceImports);
			if (type.startsWith(name)) {
				if (type.length == name.length) {
					return true;
				}
				else if (type.charAt(name.length) == '.') {
					type = type.substr(name.length + 1);
					return true;
				}
			}

			return false;
		});

		if (foundImport.length) {
			return {
				importDeclaration: foundImport[0],
				type: type
			};
		}

		return null;
	}
}