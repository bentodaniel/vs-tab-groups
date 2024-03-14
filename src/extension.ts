// VS Code extensibility API
import * as vscode from 'vscode';

import { TreeDataProvider } from './TreeDataProvider';
import { EXTENSION_ID } from './Util';

/**
 * Called when the extension is started
 */
export function activate(context: vscode.ExtensionContext) {
	let treeDataProvider = new TreeDataProvider(context);
	const treeView = vscode.window.createTreeView(EXTENSION_ID, {
		treeDataProvider: treeDataProvider
	});
	treeDataProvider.setTreeView(treeView);
	treeDataProvider.load();
	return context;
}

/**
 * Called when the extension is stopped, or vscode is closed
 */
export function deactivate() {}
