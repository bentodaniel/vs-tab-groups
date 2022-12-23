// VS Code extensibility API
import * as vscode from 'vscode';

import { vstg } from './tree_view';

export function activate(context: vscode.ExtensionContext) {

	let tree = new vstg.tree_view();
	vscode.window.registerTreeDataProvider('vs-tab-groups-container', tree);


	/*
	context.subscriptions.push(
		vscode.commands.registerCommand('vs-tab-groups.addTabGroup', async () => {
			const input = await vscode.window.showInputBox({
				prompt:"Type in the name of the tab group to be created.\n"
			});		
			
			if (input && input !== "") {
				vscode.window.showInformationMessage(`adding group ${input}`);
			}
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('vs-tab-groups.removeTabGroup', () => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage('removing a group');
		})
	)
	*/
}

export function deactivate() {}
