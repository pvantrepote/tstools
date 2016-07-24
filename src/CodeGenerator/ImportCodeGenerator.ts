import * as vscode from 'vscode';
import * as ts from 'typescript';
import * as path from 'path';
import { TreeWalker } from './Contexts/TreeWalker';
import { GeneratorContextProvider } from './GeneratorContextProvider';
import { ImportGeneratorContext } from './Contexts/ImportGeneratorContext';
import { ImportGenerator } from './Generators/ImportGenerator';

export class ImportCodeGenerator {

	private _context: ImportGeneratorContext;

	/**
	 * Init the code generator
	 * 
	 * @static
	 * @returns {CodeGenerator}
	 */
	public static init(): ImportCodeGenerator {
		let position = vscode.window.activeTextEditor.selection.active;
		let currentDocument = vscode.window.activeTextEditor.document;
		let offset = currentDocument.offsetAt(position);

		let context = GeneratorContextProvider.createImportContext(currentDocument.getText(), currentDocument.uri.fsPath, offset);
		if (!context) {
			return null;
		}
		// Return new Generator
		return new ImportCodeGenerator(context);

	}

	constructor(context: ImportGeneratorContext) {
		this._context = context;
	}

	/**
	 * Generate import code
	 * 
	 * @param {string} sourceFilePath The current source file path
	 * @param {string} sourceCode The current source code
	 * @param {number} offset The cursor offset
	 * @returns {Thenable<void>}
	 */
	public generate(): Thenable<boolean> {
		return vscode.window.activeTextEditor.edit((editor: vscode.TextEditorEdit) => {
			let str = ImportGenerator.Generate(this._context);

			if (this._context.declaringElements) {
				let start = vscode.window.activeTextEditor.document.positionAt(this._context.declaringElements.pos);
				let end = vscode.window.activeTextEditor.document.positionAt(this._context.declaringElements.end);

				editor.replace(new vscode.Range(start, end), str);
			}
			else {
				let offset = this._context.insertAtOffset;
				let location = vscode.window.activeTextEditor.document.positionAt(offset);
				editor.insert(location, str);
			}
		});
	}

}