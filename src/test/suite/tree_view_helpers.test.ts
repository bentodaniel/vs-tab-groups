import * as assert from 'assert';

import * as vscode from 'vscode';

import { vstg } from '../../tree_view';

suite('TreeView Helper Methods Test Suite', () => {
	vscode.window.showInformationMessage('Start all \'TreeView Helper Methods\' tests.');

	test("Should start extension 'VS Tab Groups'", async () => {
		const started = vscode.extensions.getExtension(
			"bentodaniel.vs-tab-groups",
		);
		assert.notEqual(started, undefined);
		assert.equal(started?.isActive, true);
	});


    // TODO


})