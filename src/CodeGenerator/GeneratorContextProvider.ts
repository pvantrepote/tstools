import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as path from 'path';
import { TreeWalker, ResolvedSymbol } from './Contexts/TreeWalker';
import { InterfaceGeneratorContext } from './Contexts/InterfaceGeneratorContext';
import { PropertyGeneratorContext } from './Contexts/PropertyGeneratorContext';
import { ImportGeneratorContext } from './Contexts/ImportGeneratorContext';
import { Declaration } from './Contexts/Declaration';

export class GeneratorContextProvider {

	public static createImportContext(document: string, documentPath: string, offset: number): ImportGeneratorContext {
		let walker: TreeWalker = new TreeWalker();

		// Get the source file
		let documentSourceFile = walker.getSourceFile(documentPath, document);
		let sourceFolder = path.parse(documentPath).dir;

		// Lookup for the node under the cursor	
		let nodeAtOffset = walker.getNodeAtOffset(documentSourceFile, offset);
		if (!nodeAtOffset) {
			return null;
		}

		// Get the symbol from the provider
		let symbol = walker.resolveSymbolForNode(documentSourceFile, nodeAtOffset);
		if (!symbol || symbol.refOrImport) {
			console.error("No symbol found or already imported.");
			return;
		}

		// Is it the same file?
		let documentModulePath = './' + (path.parse(documentPath).name);
		let filepath = path.join(vscode.workspace.rootPath, symbol.relativePath);
		let moduleDirectory = path.relative(sourceFolder, filepath);

		if (moduleDirectory != null) { 
			// Clean path to provide invariant slashes
			moduleDirectory = moduleDirectory.replace(/\\/g, "/").replace(/\/\//g, "/");
			if (!moduleDirectory.startsWith("./") &&
				!moduleDirectory.startsWith("../") &&
				!moduleDirectory.startsWith("/")) {
				moduleDirectory = "./" + moduleDirectory;
			}
		}

		if (moduleDirectory == documentModulePath) {
			return null;
		}

		// Part of namespace
		if (symbol.hasNamespace) {
			moduleDirectory = moduleDirectory + ".ts";

			return new ImportGeneratorContext(symbol.hasNamespace, 0, documentSourceFile, symbol.symbol, symbol.moduleName, moduleDirectory, walker);
		}

		let importPosition: number = 0;
		let importNode: ts.ImportDeclaration;

		if (!symbol.refOrImport) {
			// Lookup if we already have an import for this module
			let nodes = walker.getAllNodesOfType<ts.ImportDeclaration>(documentSourceFile, ts.SyntaxKind.ImportDeclaration, (node: ts.ImportDeclaration): boolean => {
				importPosition = node.end;

				if (node.moduleSpecifier) {
					let name = walker.getTextForNode(node.moduleSpecifier);
					return name.endsWith(symbol.moduleName);
				}

				return false;
			});

			if (nodes && nodes.length) {
				importNode = nodes[0];
			}
		}
		else {
			importNode = symbol.refOrImport as ts.ImportDeclaration;
		}

		if (importNode) {

			if (importNode.importClause.namedBindings) {
				if (importNode.importClause.namedBindings.kind == ts.SyntaxKind.NamespaceImport) {
					return null;
				}
				
				let decl = walker.getAllNodesOfType<ts.ImportSpecifier>(documentSourceFile, ts.SyntaxKind.ImportSpecifier, (node: ts.ImportSpecifier): boolean => {
					if (walker.getTextForNode(node) == symbol.symbol) {
						return true;
					}
					else {
						importPosition = node.end - importNode.pos;
					}
				}, importNode.importClause.namedBindings);

				if (decl && decl.length) {
					return null;
				}
			}
		}

		return new ImportGeneratorContext(symbol.hasNamespace, importPosition, documentSourceFile, symbol.symbol, symbol.moduleName, moduleDirectory, walker, importNode);

	}

	// Resolve the type under the cursor
	public static createGeneratorContext(document: string, documentPath: string, offset: number): InterfaceGeneratorContext | PropertyGeneratorContext {
		let walker = new TreeWalker();

		// Get the source file
		let sourceFile = walker.getSourceFile(documentPath, document);

		// Lookup for the node under the cursor	
		let nodeAtOffset = walker.getNodeAtOffset(sourceFile, offset);

		// Get the declaring type
		let declaringElement = walker.findDeclarationForNode(sourceFile, nodeAtOffset);
		if (!declaringElement) {
			return null;
		}

		if (declaringElement.kind == ts.SyntaxKind.PropertyDeclaration) {
			return new PropertyGeneratorContext(sourceFile, declaringElement as ts.PropertyDeclaration, new Declaration(sourceFile, declaringElement as ts.PropertyDeclaration), walker);
		}

		// Lookup for the symbol
		let symbol = walker.resolveSymbolForNode(sourceFile, nodeAtOffset);
		if (!symbol) {
			return null;
		}

		let symbolSourceFile = walker.getSourceFileForSymbol(symbol);
		if (!symbolSourceFile) {
			return null;
		}

		let typeDeclaration = walker.getNodeForSymbol(symbolSourceFile, symbol) as ts.Declaration;
		if (!typeDeclaration) {
			// Ohoh, .. Issue?
			return null;
		}

		// Init the context
		return new InterfaceGeneratorContext(sourceFile, declaringElement as ts.ClassDeclaration, new Declaration(symbolSourceFile, typeDeclaration), walker);
	}

}