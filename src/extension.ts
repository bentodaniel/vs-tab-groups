// VS Code extensibility API
import * as vscode from 'vscode';

import { vstg } from './tree_view';

/**
 * Called when the extension is started
 */
export function activate(context: vscode.ExtensionContext) {
	let tree = new vstg.tree_view(context);
	vscode.window.registerTreeDataProvider('vs_tab_groups', tree);
	tree.load();
	return context;
}

/**
 * Called when the extension is stopped, or vscode is closed
 */
export function deactivate() {}
