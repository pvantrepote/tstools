import * as vscode from 'vscode';
import * as ts from 'typescript';
import { InterfaceGeneratorContext } from '../Contexts/InterfaceGeneratorContext';
import { PropertyGeneratorContext } from '../Contexts/PropertyGeneratorContext';
import { MethodGenerator } from './MethodGenerator';
import { PropertyGenerator } from './PropertyGenerator';

export class Generator {

	/**
	 * Generate code
	 * 
	 * @static
	 * @param {ts.Node} node The node to generate code for
	 * @param {ts.SourceFile} source The sourc code
	 * @param {(InterfaceGeneratorContext | PropertyGeneratorContext)} context The context
	 * @param {vscode.TextDocument} document The target source code
	 * @param {vscode.TextEditorEdit} editor The editor
	 */
	public static GenerateCode(node: ts.Node, source: ts.SourceFile, context: InterfaceGeneratorContext | PropertyGeneratorContext, document: vscode.TextDocument, editor: vscode.TextEditorEdit) {

		let signature: string;
		if (node.kind == ts.SyntaxKind.PropertyDeclaration) {
			if (context.type() == PropertyGeneratorContext.type()) {
				signature = PropertyGenerator.GenerateForDeclarationInClass(<ts.PropertyDeclaration>node, source, context as PropertyGeneratorContext, document, editor);
			}
			else {
				signature = PropertyGenerator.GenerateForDeclaration(<ts.PropertyDeclaration>node, source, context as InterfaceGeneratorContext);
			}
		}
		else if ((node.kind == ts.SyntaxKind.MethodDeclaration) ||
				 (node.kind == ts.SyntaxKind.MethodSignature)) {
			signature = MethodGenerator.Generate(<ts.SignatureDeclaration>node, source, context as InterfaceGeneratorContext);
		}
		else if (node.kind == ts.SyntaxKind.PropertySignature) {
			signature = PropertyGenerator.Generate(<ts.PropertySignature>node, source, context as InterfaceGeneratorContext);
		}

		if (signature) {
			editor.insert(document.positionAt(context.insertAtOffset), signature);
		}

	}

}