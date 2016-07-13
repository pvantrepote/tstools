import * as ts from 'typescript';
import { CodeGeneratorContext } from './CodeGeneratorContext';

export class PropertyGeneratorContext extends CodeGeneratorContext<ts.PropertyDeclaration> {

	public get insertAtOffset(): number {
		return this.declaringElements.end;
	}

	public type(): string {
		return PropertyGeneratorContext.type();
	}

	public static type(): string {
		return "PropertyGeneratorContext";
	}
}