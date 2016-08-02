import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ICommand } from './../ICommand';
import { TreeWalker } from './../../CodeGenerator/Contexts/TreeWalker';

export class CommandRefactor implements ICommand {
	
	public get name(): string {
		return 'extension.refactor';
	};

	public execute(): Thenable<void> {
		let walker = new TreeWalker(false);
		let url = vscode.window.activeTextEditor.document.uri.fsPath;

		let sourceFile = walker.getSourceFile(url, vscode.window.activeTextEditor.document.getText());



		return Promise.resolve();
	}
}