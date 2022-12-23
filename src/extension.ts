// VS Code extensibility API
import * as vscode from 'vscode';

import { vstg } from './tree_view';

export function activate(context: vscode.ExtensionContext) {
	let tree = new vstg.tree_view();
	vscode.window.registerTreeDataProvider('vs_tab_groups', tree);
}

export function deactivate() {}
