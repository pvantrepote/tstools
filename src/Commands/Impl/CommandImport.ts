import * as vscode from 'vscode';
import { ICommand } from '../ICommand';
import { ImportCodeGenerator } from '../../CodeGenerator/ImportCodeGenerator';

class CommandImport implements ICommand {

	public get name(): string {
		return 'extension.import';
	}

	public execute(): Thenable<void> {
		let generator = ImportCodeGenerator.init();
		if (!generator) {
			return;
		}

		return generator.generate()
			.then(()=> {
				return;
			});
	}

}

export { CommandImport };