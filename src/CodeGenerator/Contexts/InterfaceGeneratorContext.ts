import * as ts from 'typescript';
import { CodeGeneratorContext } from './CodeGeneratorContext';
import { TreeWalker } from './TreeWalker';
import { Declaration, MemberDeclaration } from './Declaration';


export class InterfaceGeneratorContext extends CodeGeneratorContext<ts.ClassDeclaration> {

	private _allMethods: Array<MemberDeclaration>;
	private _allProperties: Array<MemberDeclaration>;

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

	public get properties(): Array<MemberDeclaration> {
		if (!this._allProperties) {

			if (this.declaration.isAbstractClass()) {
				this._allProperties = this.getMethods<ts.PropertyDeclaration>(ts.SyntaxKind.PropertyDeclaration);

				if (this.parents) {
					this.parents.forEach((declarationContext: Declaration) => {
						let members = this.getMethods<ts.PropertyDeclaration>(ts.SyntaxKind.PropertyDeclaration, declarationContext);

						this._allProperties = members.concat(this._allProperties);
					});
				}
			}
			else {
				this._allProperties = this.getMethods<ts.PropertySignature>(ts.SyntaxKind.PropertySignature);

				if (this.parents) {
					this.parents.forEach((declarationContext: Declaration) => {
						let members = this.getMethods<ts.PropertySignature>(ts.SyntaxKind.PropertySignature, declarationContext);

						this._allProperties = members.concat(this._allProperties);
					});
				}
			}
		}

		return this._allProperties;
	}

	public get methods(): Array<MemberDeclaration> {
		if (!this._allMethods) {

			if (this.declaration.isAbstractClass()) {
				this._allMethods = this.getMethods<ts.MethodDeclaration>(ts.SyntaxKind.MethodDeclaration);

				if (this.parents) {
					this.parents.forEach((declarationContext: Declaration) => {
						let members = this.getMethods<ts.MethodDeclaration>(ts.SyntaxKind.MethodDeclaration, declarationContext);

						this._allMethods = members.concat(this._allMethods);
					});
				}
			}
			else {
				this._allMethods = this.getMethods<ts.MethodSignature>(ts.SyntaxKind.MethodSignature);

				if (this.parents) {
					this.parents.forEach((declarationContext: Declaration) => {
						let members = this.getMethods<ts.MethodSignature>(ts.SyntaxKind.MethodSignature, declarationContext);

						this._allMethods = members.concat(this._allMethods);
					});
				}
			}
		}

		return this._allMethods;
	}

	private getMethods<T extends ts.Declaration>(kind: ts.SyntaxKind, declaration?: Declaration): Array<MemberDeclaration> {
		if (!declaration) {
			declaration = this.declaration;
		}

		return this.walker.getAllNodesOfType<T>(declaration.sourceFile, kind, null, declaration.node)
			.map((method: T) => {
				return new MemberDeclaration(method, declaration.sourceFile);
			});
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