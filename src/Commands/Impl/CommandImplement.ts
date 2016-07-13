import * as vscode from 'vscode';
import { ICommand } from '../ICommand';
import { CodeDescription, CodeGenerator } from '../../CodeGenerator/CodeGenerator';

class ImplementChoice implements vscode.QuickPickItem {
	public label: string;
	public description: string;
	public detail: string;
	public codeDescription: CodeDescription;

	constructor(label: string | CodeDescription, description?: string, details?: string) {
		if ((<CodeDescription>label).name) {
			this.label = (<CodeDescription>label).name;
			this.description = (<CodeDescription>label).description;
			this.codeDescription = (<CodeDescription>label);
		}
		else {
			this.label = <string>label;
			this.description = description;
		}

		this.detail = details;
	}
}

class CommandImplement implements ICommand {

	public get name(): string {
		return 'extension.implement';
	}

	public execute(): Thenable<void> {
		let generator = CodeGenerator.init();
		if (!generator) {
			return;
		}

		let all = new ImplementChoice("---- All ----", "Implement all members");
		let allProperties = new ImplementChoice("---- All Properties ----", "Implement all properties");
		let allMethods = new ImplementChoice("---- All Methods ----", "Implement all methods");

		let choices = new Array<ImplementChoice>()
		if (generator.hasMethods() && generator.hasProperties()) {
			choices.push(all);
		}
		if (generator.hasProperties()) {
			choices.push(allProperties);

			let descriptions = generator.getAllPropertiesDescription();
			descriptions.forEach((description: CodeDescription) => {
				choices.push(new ImplementChoice(description));
			});
		}

		if (generator.hasMethods()) {
			choices.push(allMethods);

			let descriptions = generator.getAllMethodsDescription();
			descriptions.forEach((description: CodeDescription) => {
				choices.push(new ImplementChoice(description));
			});
		}

		// Nothing to do?
		if (!choices.length) {
			return;
		}

		// Show selection
		return vscode.window.showQuickPick<ImplementChoice>(choices)
			.then((item: ImplementChoice) => {
				if (!item) {
					return;
				}

				let promise: Thenable<boolean>;
				if (item == all) {
					promise = generator.generateAll();
				}
				else if (item == allMethods) {
					promise = generator.generateAllMethods();
				}
				else if (item == allProperties) {
					promise = generator.generateAllProperties();
				}
				else {
					promise = generator.generate(item.codeDescription);
				}

				return promise.then(() => {
					return;
				});
			});

	}

}

export { CommandImplement };