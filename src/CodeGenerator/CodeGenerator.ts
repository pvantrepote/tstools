import * as vscode from 'vscode';
import * as ts from 'typescript';
import { Generator } from './Generators/Generator';
import { Declaration, MemberDeclaration } from './Contexts/Declaration';
import { GeneratorContextProvider } from './GeneratorContextProvider';
import { InterfaceGeneratorContext } from './Contexts/InterfaceGeneratorContext';
import { PropertyGeneratorContext } from './Contexts/PropertyGeneratorContext';

class CodeDescription {
	public name: string;
	public description: string;
	public details: string;
	public declaration: MemberDeclaration;

	constructor(name: string, description: string, declaration: MemberDeclaration, details?: string) {
		this.name = name;
		this.description = description;
		this.details = details;
		this.declaration = declaration;
	}
}


class CodeGenerator {

	private _context: InterfaceGeneratorContext | PropertyGeneratorContext;
	private _allMethods: Array<MemberDeclaration>;
	private _allProperties: Array<MemberDeclaration>;

	public hasMethods(): boolean {
		return ((this._allMethods) && (this._allMethods.length > 0));
	}
	public getAllMethodsDescription(): Array<CodeDescription> {
		return this.getDescription(this._allMethods);
	}

	public hasProperties(): boolean {
		return ((this._allProperties) && (this._allProperties.length > 0));
	}
	public getAllPropertiesDescription(): Array<CodeDescription> {
		return this.getDescription(this._allProperties);
	}

	constructor(context: InterfaceGeneratorContext | PropertyGeneratorContext) {
		this._context = context;

		if (context.type() == PropertyGeneratorContext.type()) {
			this._allProperties = (context as PropertyGeneratorContext).properties;
		}
		else {
			let classContext = context as InterfaceGeneratorContext;

			// All Methods & Properties
			this._allMethods = classContext.methods;
			this._allProperties = classContext.properties;
		}

	}

	public generateAll(): Thenable<boolean> {
		return this.generateAllMethods()
			.then(() => {
				return this.generateAllProperties();
			});
	}

	public generateAllMethods(): Thenable<boolean> {
		return this._allMethods.reduce((p: Promise<boolean>, method: MemberDeclaration) => {
			return p.then(() => {
				return this.generateCodeFor(method)
			});
		}, Promise.resolve(true));
	}

	public generateAllProperties(): Thenable<boolean> {
		return this._allProperties.reduce((p: Promise<boolean>, method: MemberDeclaration) => {
			return p.then(() => {
				return this.generateCodeFor(method)
			});
		}, Promise.resolve(true));
	}

	public generate(codeDescription: CodeDescription): Thenable<boolean> {
		return this.generateCodeFor(codeDescription.declaration);
	}

	private generateCodeFor(member: MemberDeclaration): Thenable<boolean> {
		return vscode.window.activeTextEditor.edit((editor: vscode.TextEditorEdit) => {

			Generator.GenerateCode(member.node, member.source, this._context, vscode.window.activeTextEditor.document, editor);
		});
	}

	private getDescription(values: Array<MemberDeclaration>): Array<CodeDescription> {
		let descriptions = new Array<CodeDescription>();

		values.forEach((value: MemberDeclaration) => {
			let end = value.node.end;
			if (value.node.kind == ts.SyntaxKind.MethodDeclaration) {
				let body = value["body"];
				if (body) {
					end = body.pos;
				}
			}

			let start = value.node.pos;
			let description = value.source.getFullText().substring(start, end).trim();
			let label = (<ts.Identifier>value.node.name).text;

			descriptions.push(new CodeDescription(label, description, value));
		});

		return descriptions;
	}

	/**
	 * Init the code generator
	 * 
	 * @static
	 * @returns {CodeGenerator}
	 */
	public static init(): CodeGenerator {
		let position = vscode.window.activeTextEditor.selection.active;
		let currentDocument = vscode.window.activeTextEditor.document;
		let offset = currentDocument.offsetAt(position);

		let context = GeneratorContextProvider.createGeneratorContext(currentDocument.getText(), currentDocument.uri.fsPath, offset)
		if (!context) {
			return null;
		}

		// Return new Generator
		return new CodeGenerator(context);
	}

}

export { MemberDeclaration, CodeDescription, CodeGenerator }