import * as vscode from 'vscode';
import * as ts from 'typescript';
import { StringHelpers } from '../../Tools/StringHelpers';
import { PropertyGeneratorContext } from '../Contexts/PropertyGeneratorContext';
import { InterfaceGeneratorContext } from '../Contexts/InterfaceGeneratorContext';

class PropertyGenerator {

	private static PropertyTpl = "{0}\
	private _{1}: {2};{0}\
	public get {1}(): {2} {{0}\
        return this._{1};{0}\
	};{0}\
   	public set {1}(value: {2}) {{0}\
        this._{1} = value;{0}\
    };{0}";

	private static PropertyBodyTpl = "{0}\
	public get {1}(): {2} {{0}\
        return this._{1};{0}\
	};{0}\
   	public set {1}(value: {2}) {{0}\
        this._{1} = value;{0}\
    };";

	public static Generate(propertySig: ts.PropertySignature, source: ts.SourceFile, context: InterfaceGeneratorContext): string {
		let typeString = source.getFullText().substring(propertySig.type.pos, propertySig.type.end).trim();
		let name = context.walker.getTextForNode(propertySig);

		return StringHelpers.format(this.PropertyTpl, context.newLine, name, typeString);
	}

	public static GenerateForDeclaration(propertyDecl: ts.PropertyDeclaration, source: ts.SourceFile, context: InterfaceGeneratorContext): string {
		let typeString = source.getFullText().substring(propertyDecl.type.pos, propertyDecl.type.end).trim();
		let name = context.walker.getTextForNode(propertyDecl);

		return StringHelpers.format(this.PropertyTpl, context.newLine, name, typeString);
	}

	public static GenerateForDeclarationInClass(propertyDecl: ts.PropertyDeclaration, source: ts.SourceFile, context: PropertyGeneratorContext, document: vscode.TextDocument, editor: vscode.TextEditorEdit): string {
		// Check if the declaration name stats with _
		let name = context.walker.getTextForNode(propertyDecl);
		if (!name.startsWith('_')) {
			let position = document.positionAt(propertyDecl.name.pos+1);
			editor.insert(position, '_');
		}
		else {
			// Remove the _
			name = name.substr(1);
		}

		// Check if it is a public property
		let found = propertyDecl.modifiers.find((modifier: ts.Modifier) => {
			return (modifier.kind == ts.SyntaxKind.PublicKeyword);
		});
		if (found) {
			// Start position is the end position -  length of public (6) this make sure we keep the whitespaces
			let startPosition = document.positionAt(found.end - 6);
			let endPosition = document.positionAt(found.end);
			let range = new vscode.Range(startPosition, endPosition);
			editor.replace(range, 'private');
		}

		let typeString = source.getFullText().substring(propertyDecl.type.pos, propertyDecl.type.end).trim();

		return StringHelpers.format(this.PropertyBodyTpl, context.newLine, name, typeString);
	}

}

export { PropertyGenerator }