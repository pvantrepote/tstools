import * as ts from 'typescript';
import { TreeWalker } from './Contexts/TreeWalker';
import { InterfaceGeneratorContext } from './Contexts/InterfaceGeneratorContext';
import { PropertyGeneratorContext } from './Contexts/PropertyGeneratorContext';
import { Declaration } from './Contexts/Declaration';

export class GeneratorContextProvider {

	// Resolve the type under the cursor
	public static createGeneratorContext(document: string, documentPath: string, offset: number): InterfaceGeneratorContext | PropertyGeneratorContext {
		let walker = new TreeWalker();

		// Get the source file
		let sourceFile = walker.getSourceFile(documentPath, document);

		// Lookup for the node under the cursor	
		let nodeAtOffset = walker.getNodeAtOffset(sourceFile, offset);

		// Get the declaring class that want to implement the interface
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
		let interfaceSourceFile = sourceFile;

		// Get the text
		let selectedType = walker.getTextForNode(nodeAtOffset);

		// First check if this is the declaration or the import
		let typeDeclaration = walker.findNodeWithText<ts.Declaration>(sourceFile, selectedType, ts.SyntaxKind.InterfaceDeclaration);
		if (!typeDeclaration) {

			// Ok, not declared in the document, then lookup the import.
			interfaceSourceFile = walker.resolveType(sourceFile, selectedType);
			if (!interfaceSourceFile) {
				// Not in the import, ok, just return
				return null;
			}

			// Ok, now we lookup into the import file
			typeDeclaration = walker.findNodeWithText<ts.Declaration>(interfaceSourceFile, selectedType, ts.SyntaxKind.InterfaceDeclaration);
			if (!typeDeclaration) {
				// Ohoh, .. Issue?
				return null;
			}
		}

		// Init the context
		return new InterfaceGeneratorContext(sourceFile, declaringClass, new Declaration(interfaceSourceFile, typeDeclaration), walker);
	}

}