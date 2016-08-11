import * as vscode from 'vscode';
import * as ts from 'typescript';

export class Declaration {

	private _isAbstractClass: boolean;
	public sourceFile: ts.SourceFile;
	public node: ts.Declaration;

	constructor(sourceFile: ts.SourceFile, node: ts.Declaration) {
		this.sourceFile = sourceFile;
		this.node = node;
	}

	public isAbstractClass(): boolean {
		if (this._isAbstractClass == undefined) {
			if (this.node.kind == ts.SyntaxKind.ClassDeclaration) {
				let classDeclaration = this.node as ts.ClassDeclaration;
				let abstractModifier = classDeclaration.modifiers.find((modifier: ts.Node): boolean => {
					return (modifier.kind == ts.SyntaxKind.AbstractKeyword);
				});

				this._isAbstractClass = (abstractModifier != undefined);
			}
		}

		return this._isAbstractClass;
	}
}

export class MemberDeclaration {
	public node: ts.Declaration;
	public source: ts.SourceFile;
	public hasImplementation: boolean;

	constructor(node: ts.Declaration, source: ts.SourceFile) {
		this.node = node;
		this.source = source;
		this.hasImplementation = (node.kind == ts.SyntaxKind.MethodDeclaration) || (node.kind == ts.SyntaxKind.PropertyDeclaration);
	}
}