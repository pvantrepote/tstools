import * as ts from 'typescript';
import { CodeGeneratorContext } from './CodeGeneratorContext';
import { MemberDeclaration } from './Declaration';

export class PropertyGeneratorContext extends CodeGeneratorContext<ts.PropertyDeclaration> {

	private _allProperties: Array<MemberDeclaration>;

	public get insertAtOffset(): number {
		return this.declaringElements.end;
	}

	public type(): string {
		return PropertyGeneratorContext.type();
	}

	public static type(): string {
		return "PropertyGeneratorContext";
	}

	public get properties(): Array<MemberDeclaration> {
		if (!this._allProperties) {
			this._allProperties = [new MemberDeclaration(this.declaration.node, this.declaration.sourceFile)];
		}

		return this._allProperties;
	}
}