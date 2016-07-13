import * as vscode from 'vscode';
import { ICommand } from './ICommand';
import { CommandImplement } from './Impl/CommandImplement';

class Commands {

	public static Register(context: vscode.ExtensionContext) {
		context.subscriptions.push(this.DoRegister(CommandImplement));
	}

	private static DoRegister<T extends ICommand>(cType: { new(): T;}) : vscode.Disposable {
		var command:T = new cType();

		return vscode.commands.registerCommand(command.name, command.execute, command);
	}

}

export { Commands }