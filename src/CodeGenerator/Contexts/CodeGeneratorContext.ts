import * as vscode from 'vscode';
import * as ts from 'typescript';
import { TreeWalker } from './TreeWalker';
import { Declaration } from './Declaration';

interface IEditor extends vscode.WorkspaceConfiguration {
	insertSpaces: boolean;
	tabSize: number;
}

export abstract class CodeGeneratorContext<T extends ts.Node> {
	public sourceFile: ts.SourceFile;
	public declaringElements: T;

	public newLine: string;
	public space: string;
	public walker: TreeWalker;

	public declaration: Declaration;

	public get insertAtOffset(): number {
		return this.declaringElements.end - 1;
	}

	constructor(sourceFile: ts.SourceFile, declaringElements: T, declaration: Declaration, walker: TreeWalker) {
		this.sourceFile = sourceFile;
		this.declaringElements = declaringElements;
		this.declaration = declaration;
		this.walker = walker;
		this.newLine = walker.newLine;

		// Fix issue #2
		let editor = vscode.workspace.getConfiguration('editor') as IEditor;
		if (editor && editor.insertSpaces) {
			// Handle tab size
			if (editor.tabSize) {
				this.space = (new Array(editor.tabSize + 1)).join(' ');
			}
			else {
				this.space = ' ';
			}
		}
		else {
			this.space = '\t';
		}
	}

	public abstract type(): string;
	public static type(): string {
		return "CodeGeneratorContext";
	}
}