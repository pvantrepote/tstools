import * as ts from 'typescript';
import { TreeWalker } from './TreeWalker';
import { CodeGeneratorContext } from './CodeGeneratorContext';

export class ImportGeneratorContext extends CodeGeneratorContext<ts.ImportDeclaration> {

	public moduleName: string;
	public moduleDirectory: string;
	public nodeToResolve: string;
	public isReferenceType: boolean;
	private insertAtPosition: number;

	constructor(isReferenceType: boolean, insertAtPosition: number, sourceFile: ts.SourceFile, nodeToResolve: string, moduleName: string, moduleDirectory: string, importNode: ts.ImportDeclaration, walker: TreeWalker) {
		super(sourceFile, importNode, null, walker);
		this.moduleName = moduleName;
		this.moduleDirectory = moduleDirectory;
		this.nodeToResolve = nodeToResolve;
		this.insertAtPosition = insertAtPosition;
		this.isReferenceType = isReferenceType;
	}

	public get insertAtOffset(): number {
		return this.insertAtPosition;
	}

	public type(): string {
		return ImportGeneratorContext.type();
	}

	public static type(): string {
		return "ImportGeneratorContext";
	}
}