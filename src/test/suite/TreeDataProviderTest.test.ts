import * as assert from 'assert';

import * as vscode from 'vscode';

import { TreeDataProvider } from '../../TreeDataProvider';

suite('TreeDataProvider Test Suite', () => {
	vscode.window.showInformationMessage('Start all \'TreeDataProvider\' tests.');

	test("Should start extension 'VS Tab Groups'", async () => {
		const started = vscode.extensions.getExtension(
			"bentodaniel.vs-tab-groups",
		);
		assert.notEqual(started, undefined);
		assert.equal(started?.isActive, true);
	});

	test("Create new tree data provider", async () => {
		const ext = vscode.extensions.getExtension("bentodaniel.vs-tab-groups");
		if (!ext) {
			throw Error("Could not get extension.")
		}
		const extensionContext = await ext.activate();

		const treeDataProvider = new TreeDataProvider(extensionContext);

		//assert.equal()
	})

    // TODO


})