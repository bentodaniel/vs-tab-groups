"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('vs-tab-groups.addTabGroup', async () => {
        const input = await vscode.window.showInputBox({ prompt: "Type in the name of the tab group to be created.\n" });
        vscode.window.showInformationMessage(`adding group ${input}`);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vs-tab-groups.removeTabGroup', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('removing a group');
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map