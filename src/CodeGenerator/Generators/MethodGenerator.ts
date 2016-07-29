import * as vscode from 'vscode';
import * as ts from 'typescript';
import { StringHelpers } from '../../Tools/StringHelpers';
import { InterfaceGeneratorContext } from '../Contexts/InterfaceGeneratorContext';

class MethodGenerator {

	private static MethodTpl = "{0}\
{4}public {1}({2}): {3} {{0}\
{4}{4}throw 'Not Implemented';{0}\
{4}}{0}";

	public static Generate(methodDecl: ts.SignatureDeclaration, source: ts.SourceFile, context: InterfaceGeneratorContext): string {
		let name = context.walker.getTextForNode(methodDecl);
		let paramStart = methodDecl.parameters.pos;
		let paramEnd = methodDecl.parameters.end;
		let paramsString = source.getFullText().substring(paramStart, paramEnd).trim();

		let typeString: string;
		if (!methodDecl.type || (methodDecl.type.kind == ts.SyntaxKind.VoidKeyword)) {
			typeString = 'void';
		}
		else {
			let typeStart = methodDecl.type.pos;
			let typeEnd = methodDecl.type.end;
			typeString = source.getFullText().substring(typeStart, typeEnd).trim();
		}

		return StringHelpers.format(this.MethodTpl, context.newLine, name, paramsString, typeString, context.space);
	}

}

export { MethodGenerator }