import * as vscode from 'vscode';
import * as ts from 'typescript';
import { TreeWalker } from './TreeWalker';
import { Declaration } from './Declaration';

export abstract class CodeGeneratorContext<T extends ts.Declaration> {
	public sourceFile: ts.SourceFile;
	public declaringElements: T;

	public newLine: string;
	public walker: TreeWalker;

	public declaration: Declaration;

	public get insertAtOffset() : number {
		return this.declaringElements.end - 1;
	}

	constructor(sourceFile: ts.SourceFile, declaringElements: T, declaration: Declaration, walker: TreeWalker) {
		this.sourceFile = sourceFile;
		this.declaringElements = declaringElements;
		this.declaration = declaration;
		this.walker = walker;
		this.newLine = walker.newLine();
	}

	public abstract type() : string;
	public static type(): string {
		return "CodeGeneratorContext";
	}
}