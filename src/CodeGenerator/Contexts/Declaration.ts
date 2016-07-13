import * as vscode from 'vscode';
import * as ts from 'typescript';

export class Declaration {
	public sourceFile: ts.SourceFile;
	public node: ts.Declaration;

	constructor(sourceFile: ts.SourceFile, node: ts.Declaration) {
		this.sourceFile = sourceFile;
		this.node = node;
	}

}
