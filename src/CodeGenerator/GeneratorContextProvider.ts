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
		if (!symbol) {
			console.error("No symbol found.");
			return;
		}

		//
		let documentModulePath = './' + (path.parse(documentPath).name);

		// Get the module name
		let moduleName = symbol.moduleName;
		let filepath = path.join(vscode.workspace.rootPath, symbol.relativePath);
		let moduleDirectory = './' + path.relative(sourceFolder, filepath);
		let importPosition: number = 0;
		let importNode: ts.ImportDeclaration;

		// Is it declared in the same file?
		if (moduleDirectory == documentModulePath) {
			return null;
		}

		if (symbol.hasNamespace) {
			moduleDirectory = moduleDirectory + ".ts";

			let foundRef = documentSourceFile.referencedFiles.find((ref: ts.FileReference) => {
				return (ref.fileName == moduleDirectory);
			});

			// Already ref, just return null
			if (foundRef) {
				return null;
			}
		}
		else {
			// Lookup if we already have an import for this module
			let nodes = walker.getAllNodesOfType<ts.ImportDeclaration>(documentSourceFile, ts.SyntaxKind.ImportDeclaration, (node: ts.ImportDeclaration): boolean => {
				importPosition = node.end;

				if (node.moduleSpecifier) {
					let name = walker.getTextForNode(node.moduleSpecifier);
					return name.endsWith(moduleName);
				}

				return false;
			});

			if (nodes && nodes.length) {
				importNode = nodes[0];

				// Verify if it was not already declared
				if (importNode.importClause.namedBindings) {
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
		}

		return new ImportGeneratorContext(symbol.hasNamespace, importPosition, documentSourceFile, symbol.symbol, moduleName, moduleDirectory, importNode, walker);
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
			return this.createPropertyContext(sourceFile, nodeAtOffset, declaringElement as ts.PropertyDeclaration, walker);
		}

		return this.createInterfaceContext(sourceFile, nodeAtOffset, declaringElement as ts.ClassDeclaration, walker);
	};

	private static createPropertyContext(sourceFile: ts.SourceFile, nodeAtOffset: ts.Node, declaringProperty: ts.PropertyDeclaration, walker: TreeWalker): PropertyGeneratorContext {
		return new PropertyGeneratorContext(sourceFile, declaringProperty, new Declaration(sourceFile, declaringProperty), walker);
	}

	private static createInterfaceContext(sourceFile: ts.SourceFile, nodeAtOffset: ts.Node, declaringClass: ts.ClassDeclaration, walker: TreeWalker): InterfaceGeneratorContext {
		//
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
		return new InterfaceGeneratorContext(sourceFile, declaringClass, new Declaration(symbolSourceFile, typeDeclaration), walker);
	}

}