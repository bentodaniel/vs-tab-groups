import * as assert from 'assert';

import * as vscode from 'vscode';

import { vstg } from '../../tree_view';

suite('TreeView Test Suite', () => {
	vscode.window.showInformationMessage('Start all \'TreeView\' tests.');

	test("Should start extension 'VS Tab Groups'", async () => {
		const started = vscode.extensions.getExtension(
			"bentodaniel.vs-tab-groups",
		);
		assert.notEqual(started, undefined);
		assert.equal(started?.isActive, true);
	});

	test("Create new tree view", async () => {
		const ext = vscode.extensions.getExtension("bentodaniel.vs-tab-groups");
		if (!ext) {
			throw Error("Could not get extension.")
		}
		const extensionContext = await ext.activate();

		const tree_view = new vstg.tree_view(extensionContext);

		//assert.equal()
	})

    // TODO


})