'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Commands } from './Commands/Commands';
import { SymbolProvider } from './CodeGenerator/Contexts/Symbols/SymbolProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Register all commands
    Commands.Register(context);

    //
    return SymbolProvider.Instance.init(context);
}

// this method is called when your extension is deactivated
export function deactivate() {
}