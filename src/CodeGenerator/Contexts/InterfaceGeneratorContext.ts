import * as ts from 'typescript';
import { CodeGeneratorContext } from './CodeGeneratorContext';
import { TreeWalker } from './TreeWalker';
import { Declaration } from './Declaration';

export class InterfaceGeneratorContext extends CodeGeneratorContext<ts.ClassDeclaration> {

	private _parents: Array<Declaration>;
	public get parents() : Array<Declaration> {
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

	private createParentsHierarchy(currentTypeSource: ts.SourceFile, currentType: ts.InterfaceDeclaration) {

		if (!currentType.heritageClauses) {
			return;
		}

		currentType.heritageClauses.forEach((clause: ts.HeritageClause) => {
			let parents = this.walker.getAllNodesOfType(currentTypeSource, ts.SyntaxKind.ExpressionWithTypeArguments, null, clause)
				.map((expression: ts.ExpressionWithTypeArguments) => {
					return this.walker.getTextForNode(expression.expression);
				})
				.map((selectedType: string) => {
					let interfaceSourceFile = currentTypeSource;

					// First check if this is the declaration or the import
					let typeDeclaration = this.walker.findNodeWithText<ts.InterfaceDeclaration>(interfaceSourceFile, selectedType, ts.SyntaxKind.InterfaceDeclaration);
					if (!typeDeclaration) {

						// Ok, not declared in the document, then lookup the import.
						interfaceSourceFile = this.walker.resolveType(currentTypeSource, selectedType);
						if (!interfaceSourceFile) {
							// Not in the import, ok, just return
							return;
						}

						// Ok, now we lookup into the import file
						typeDeclaration = this.walker.findNodeWithText<ts.InterfaceDeclaration>(interfaceSourceFile, selectedType, ts.SyntaxKind.InterfaceDeclaration);
						if (!typeDeclaration) {
							// Ohoh, .. Issue?
							return;
						}
					}

					// Add to the list
					this.parents.push(new Declaration(interfaceSourceFile, typeDeclaration));

					// And again
					this.createParentsHierarchy(interfaceSourceFile, typeDeclaration);
				});

		});

	}
}