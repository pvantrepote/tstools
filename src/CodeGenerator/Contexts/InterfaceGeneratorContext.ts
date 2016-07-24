import * as ts from 'typescript';
import { CodeGeneratorContext } from './CodeGeneratorContext';
import { TreeWalker } from './TreeWalker';
import { Declaration } from './Declaration';


export class InterfaceGeneratorContext extends CodeGeneratorContext<ts.ClassDeclaration> {

	private _parents: Array<Declaration>;
	public get parents(): Array<Declaration> {
		if (!this._parents) {
			this._parents = new Array<Declaration>();
			this.createParentsHierarchy(this.declaration.sourceFile, this.declaration.node as ts.InterfaceDeclaration);
		}

		return this._parents;
	}

	public type(): string {
		return InterfaceGeneratorContext.type();
	}

	public static type(): string {
		return "InterfaceGeneratorContext";
	}

	private createParentsHierarchy(currentTypeSource: ts.SourceFile, currentType: ts.InterfaceDeclaration | ts.ClassDeclaration) {

		if (!currentType.heritageClauses) {
			return;
		}

		currentType.heritageClauses.forEach((clause: ts.HeritageClause) => {
			let parents = this.walker.getAllNodesOfType(currentTypeSource, ts.SyntaxKind.ExpressionWithTypeArguments, null, clause)
				.map((expression: ts.ExpressionWithTypeArguments) => {
					return this.walker.getTextForNode(expression.expression);
				})
				.map((selectedType: string) => {
					// Find the Symbol
					let symbol = this.walker.resolveSymbol(selectedType);

					// Load the sourceFile
					let interfaceSourceFile = this.walker.getSourceFileForSymbol(symbol);

					// Get the declaration type
					let typeDeclaration = this.walker.getNodeForSymbol(interfaceSourceFile, symbol) as ts.Declaration;

					// Add to the list
					this.parents.push(new Declaration(interfaceSourceFile, typeDeclaration));

					if (typeDeclaration.kind == ts.SyntaxKind.InterfaceDeclaration ||
						typeDeclaration.kind == ts.SyntaxKind.ClassDeclaration) {
						// And again
						this.createParentsHierarchy(interfaceSourceFile, typeDeclaration as (ts.InterfaceDeclaration | ts.ClassDeclaration));
					}
				});

		});

	}
}