import * as assert from 'assert';

import * as vscode from 'vscode';

import { TreeItem } from '../../TreeItem';

suite('TreeItem Test Suite', () => {
	vscode.window.showInformationMessage('Start all \'TreeItem\' tests.');

	test("Should start extension 'VS Tab Groups'", async () => {
		const started = vscode.extensions.getExtension(
			"bentodaniel.vs-tab-groups",
		);
		assert.notEqual(started, undefined);
		assert.equal(started?.isActive, true);
	});

	test("Create tree root item", async () => {
		const root_item = new TreeItem("Root", null, true);
		assert.equal(root_item.label, "Root");
		assert.equal(root_item.isRoot, true);
		assert.equal(root_item.file, null);
		assert.equal(root_item.parentLabel, undefined);
		assert.equal(root_item.children.length, 0)
	})

	test("Create tree child item", async () => {
		const child_item = new TreeItem("Child", "path/to/file", false);
		assert.equal(child_item.label, "Child");
		assert.equal(child_item.isRoot, false);
		assert.equal(child_item.file, "path/to/file");
		assert.equal(child_item.parentLabel, undefined);
		assert.equal(child_item.children.length, 0)
	})

	test("Try set parent label on root", async () => {
		const item = new TreeItem("Root", null, true);
		assert.equal(item.parentLabel, undefined);
		assert.throws(
			() => { item.setParentLabel("Root's parent") },
			Error,
			"Error thrown"
		)
	})

	test("Set parent label on child", async () => {
		const child_item = new TreeItem("Child", "path/to/file", false);
		assert.equal(child_item.parentLabel, undefined);
		child_item.setParentLabel("Root");
		assert.equal(child_item.parentLabel, "Root");
	})

	test("Add child to root", async () => {
		const root_item = new TreeItem("Root", null, true);
		const child_item = new TreeItem("Child", "path/to/file", false);

		root_item.add_child(child_item);

		assert.equal(root_item.children.length, 1);
		assert.equal(root_item.children[0], child_item);
	})

	test("Try add child to child", async () => {
		const child_item = new TreeItem("Child", "path/to/file", false);
		const child_child_item = new TreeItem("Child Child", "path/to/file/child", false);
		assert.equal(child_item.isRoot, false);
		assert.throws(
			() => { child_item.add_child(child_child_item) },
			Error,
			"Error thrown"
		)
	})

	test("Remove child that exists", async () => {
		const root_item = new TreeItem("Root", null, true);
		const child_item = new TreeItem("Child", "path/to/file", false);

		root_item.add_child(child_item);

		assert.equal(root_item.children.length, 1);
		assert.equal(root_item.children[0], child_item);

		const result = root_item.remove_child(child_item);

		assert.equal(result, true);
		assert.equal(root_item.children.length, 0);
	})

	test("Remove child that does not exist", async () => {
		const root_item = new TreeItem("Root", null, true);
		const child_item = new TreeItem("Child", "path/to/file", false);

		root_item.add_child(child_item);

		assert.equal(root_item.children.length, 1);
		assert.equal(root_item.children[0], child_item);

		const other_item = new TreeItem("Other", "path/to/other/file", false);
		const result = root_item.remove_child(other_item);

		assert.equal(result, false);
		assert.equal(root_item.children.length, 1);
	})
	
	test("Convert item without children to JSON", async () => {
		const root_item = new TreeItem("Root", null, true);
		const dataJSON = await root_item.toJSON();

		assert.equal(Object.keys(dataJSON).length, 6);
		assert.equal(dataJSON.label, "Root");
		assert.equal(dataJSON.file, null);
		assert.equal(dataJSON.isRoot, true);
		assert.equal(dataJSON.iconPath, undefined);
		assert.equal(Object.keys(dataJSON.children).length, 0);
		assert.equal(dataJSON.parentLabel, undefined);
	})

	test("Convert item with children to JSON", async () => {
		const root_item = new TreeItem("Root", null, true);
		const child_item = new TreeItem("Child", "path/to/file", false);

		root_item.add_child(child_item);
		child_item.setParentLabel("Root")

		const dataJSON = await root_item.toJSON();

		//Asserts on parent
		assert.equal(Object.keys(dataJSON).length, 6);
		assert.equal(dataJSON.label, "Root");
		assert.equal(dataJSON.file, null);
		assert.equal(dataJSON.isRoot, true);
		assert.equal(dataJSON.iconPath, undefined);
		assert.equal(Object.keys(dataJSON.children).length, 1);
		assert.equal(dataJSON.parentLabel, undefined);
		//Asserts on child
		const childJSON = dataJSON.children["key_0"];
		assert.equal(Object.keys(childJSON).length, 6);
		assert.equal(childJSON.label, "Child");
		assert.equal(childJSON.file, "path/to/file");
		assert.equal(childJSON.isRoot, false);
		assert.equal(childJSON.iconPath, vscode.ThemeIcon.File);
		assert.equal(Object.keys(childJSON.children).length, 0);
		assert.equal(childJSON.parentLabel, "Root");
	})

	test("Convert JSON to item without children", async () => {
		const dataJSON: any = {
			label: "Root",
			file: null,
			isRoot: true,
			//iconPath: undefined,  // Undefined values are removed from data
			children: {},
			//parentLabel: undefined
		}
		const item = await TreeItem.fromJSON(dataJSON);

		assert.equal(item.label, "Root");
		assert.equal(item.file, null);
		assert.equal(item.isRoot, true);
		assert.equal(item.iconPath, undefined);
		assert.equal(item.children.length, 0);
		assert.equal(item.parentLabel, undefined);
	})

	test("Convert JSON to item with children", async () => {
		const dataJSON: any = {
			label: "Root",
			file: null,
			isRoot: true,
			//iconPath: undefined,  // Undefined values are removed from data
			children: {
				key_0: {
					label: "Child",
					file: "path/to/file",
					isRoot: false,
					iconPath: vscode.ThemeIcon.File,
					children: {},
					parentLabel: "Root"
				}
			},
			//parentLabel: undefined
		}
		const item = await TreeItem.fromJSON(dataJSON);

		// Asserts on root
		assert.equal(item.label, "Root");
		assert.equal(item.file, null);
		assert.equal(item.isRoot, true);
		assert.equal(item.iconPath, undefined);
		assert.equal(item.children.length, 1);
		assert.equal(item.parentLabel, undefined);
		// Asserts on child
		assert.equal(item.children[0].label, "Child");
		assert.equal(item.children[0].file, "path/to/file");
		assert.equal(item.children[0].isRoot, false);
		assert.equal(item.children[0].iconPath, vscode.ThemeIcon.File);
		assert.equal(item.children[0].children.length, 0);
		assert.equal(item.children[0].parentLabel, "Root");
	})
});
