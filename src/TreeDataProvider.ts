import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { TreeItem } from "./TreeItem";
import { EXTENSION_ID, NEW_GROUP_LABEL, ValidationResult, createQuickPickGroupsOptions, getCurrentlyOpenFiles, normalizePath, validateWorkspace } from './Util';

/**
 * The tree view class. Represents the explorer tree.
 */
export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private readonly context: vscode.ExtensionContext;
    // m_data holds all tree items
    private m_data: TreeItem[] = [];
    private treeView: vscode.TreeView<TreeItem> | undefined;
    // with the vscode.EventEmitter we can refresh our  tree view
    private m_onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> = 
        new vscode.EventEmitter<TreeItem | undefined>();
    // and vscode will access the event by using a readonly onDidChangeTreeData 
    //(this member has to be named like here, otherwise vscode doesnt update our treeview.
    readonly onDidChangeTreeData?: vscode.Event<TreeItem | undefined> = this.m_onDidChangeTreeData.event;

    /**
     * Create a new tree view.
     * Register all the commands available for this tree.
     * @param context The context of the extension
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        // Top level, add a new group
        vscode.commands.registerCommand("vs_tab_groups.expandAllGroups", () => this.expandAllGroups());
        vscode.commands.registerCommand("vs_tab_groups.collapseAllGroups", () => this.collapseAllGroups());
        vscode.commands.registerCommand("vs_tab_groups.addTabGroup", () => this.addTabGroup());
        vscode.commands.registerCommand("vs_tab_groups.removeAllGroups", () => this.removeAllGroups());

        // Mid level, actions on tab groups
        vscode.commands.registerCommand("vs_tab_groups.addEntry", (parent) => this.addChildToItem(parent));
        vscode.commands.registerCommand("vs_tab_groups.openTabGroup", (item) => this.openTabGroup(item));
        vscode.commands.registerCommand("vs_tab_groups.closeTabGroup", (item) => this.closeTabGroup(item));
        vscode.commands.registerCommand("vs_tab_groups.editTabGroupIcon", (item) => this.editTabGroupIcon(item));
        vscode.commands.registerCommand("vs_tab_groups.removeTabGroup", (item) => this.removeTabGroup(item));
        vscode.commands.registerCommand("vs_tab_groups.editTabGroupName", (item) => this.editTabGroupName(item));

        // Low level, actions on tabs
        vscode.commands.registerCommand("vs_tab_groups.openTab", (item) => this.openTab(item));
        vscode.commands.registerCommand("vs_tab_groups.closeTab", (item) => this.closeTab(item));
        vscode.commands.registerCommand("vs_tab_groups.removeTab", (item) => this.removeTab(item));

        // General
        vscode.commands.registerCommand("vs_tab_groups.item_clicked", (item) => this.item_clicked(item));
        vscode.commands.registerCommand("vs_tab_groups.moveUp", (item) => this.moveItemUp(item));
        vscode.commands.registerCommand("vs_tab_groups.moveDown", (item) => this.moveItemDown(item));

        // Editor
        vscode.commands.registerCommand("vs_tab_groups.addEntryToGroup", (item) => this.addEntryToGroup(item));
        vscode.commands.registerCommand("vs_tab_groups.addAllToGroup", () => this.addAllOpenTabsToGroup());
        vscode.commands.registerCommand("vs_tab_groups.syncGroupOrder", () => this.syncOpenTabsGroupOrder());
    }

    public setTreeView(treeView: vscode.TreeView<TreeItem>) {
        this.treeView = treeView;
    }

    /**
     * Save this tree in the workspace.
     */
    public async save() {
        var treeData: any = {};

        // loop the data in this tree and pass it all to json format
        for (let i = 0; i < this.m_data.length; i++) {
            const itemJSON = await this.m_data[i].toJSON();
            treeData[`key_${i}`] = itemJSON;
        }

        this.context.workspaceState.update("treeData", treeData);
    }

    /**
     * Load a tree from the workspace.
     */
    public async load() {
        const treeData: any = this.context.workspaceState.get("treeData");

        for (let key in treeData) {
            let objValue = treeData[key];
            const item = await TreeItem.fromJSON(objValue);
            this.m_data.push(item);
        }

        this.m_onDidChangeTreeData.fire(undefined);
    }

    /**
     * @inheritDoc
     */
    public getTreeItem(item: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let title = item.label ? item.label.toString() : "";
        let result = new vscode.TreeItem(title, item.collapsibleState);
        // here we add our command which executes our memberfunction
        result.command = {
            command: "vs_tab_groups.item_clicked",
            title: title,
            arguments: [item],
        };
        result.contextValue = item.isRoot ? "vstg_root_item" : "vstg_child_item";
        result.iconPath = item.iconPath;
        return result;
    }

    /**
     * @inheritDoc
     */
    public getChildren(element: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
        if (element === undefined) {
            return this.m_data;
        }
        return element.children;
    }

    /**
     * @inheritdoc 
     */
    public getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
        if (this.m_data.includes(element)) {
            return undefined;
        }
        for (let e of this.m_data) {
            if (e.children.includes(element)) {
                return e;
            }
        }
        // TODO - this only checks first level of depth
    }

    /*** TOP LEVEL ***/

    getItemIndexByParentLabel(label: string): number {
        for (let index = 0; index < this.m_data.length; index++) {
            if (this.m_data[index].label === label) {
                return index;
            }
        }
        return -1;
    }

    /**
     * Check if a label already exists for a parent of this tree
     * @param label The label to check for
     * @returns True if an item already uses this label, false if otherwise.
     */
    labelExists(label: string): boolean {
        return this.getItemIndexByParentLabel(label) !== -1;
    }

    /**
     * Expand all groups of tabs.
     */
    async expandAllGroups() {
        this.m_data.forEach(e => {
            if(this.treeView) 
                this.treeView.reveal(e, {
                    select: false, 
                    expand: vscode.workspace.getConfiguration("vs-tab-groups").get("expandLevel")
                })
        });
    }

    /**
     * Collapse all groups of tabs.
     */
    async collapseAllGroups() {
        vscode.commands.executeCommand(`workbench.actions.treeView.${EXTENSION_ID}.collapseAll`);
    }

    /**
     * Create a new group of tabs.
     */
    async addTabGroup() {
        const input = await vscode.window.showInputBox({
            prompt: "Type in the name of the tab group to be created.\n",
        });

        if (input && input !== "") {
            if (this.labelExists(input)) {
                vscode.window.showErrorMessage(`Can not have two tab groups with name '${input}'`);
                return;
            }
            this.m_data.push(new TreeItem(input, null, true));
            this.m_onDidChangeTreeData.fire(undefined);
        }
        this.save();
    }

    /**
     * Remove all groups of tabs. Fully clears the tree.
     */
    removeAllGroups() {
        vscode.window.showInformationMessage("Are you sure you want to remove all groups?", "Yes", "No")
        .then((answer) => {
            if (answer === "Yes") {
                this.m_data = [];
                this.m_onDidChangeTreeData.fire(undefined);

                this.save();
            }
        });
    }

    /*** MID LEVEL ***/

    /**
     * Escape a string path pattern
     * @param s A string representing a path
     * @returns The path string in a format that is usable in a regex
     */
    escapeRegExp(s: string) {
        s = s.replace(/\\/g, "\\\\"); // escape all backslashes
        s = s.replace(/\./g, "\\."); // escape all dots
        s = s.replace(/\//g, "\\/"); // escape all forward slashes
        s = s.replace(/\*/g, ".*"); // when used *, the user means anything, i.e., .*
        return s;
    }

    /**
     * Check if a path should be ignored
     * @param rootPath The path pointing to the root
     * @param pathsToIgnore The patterns to ignore
     * @param currentPath The path to be checked
     * @returns True if currentPath should be ignored. False if otherwise.
     */
    shouldIgnorePath(rootPath: string, pathsToIgnore: string[], currentPath: string) {
        for (let pattern of pathsToIgnore) {
            var complete_path = path.join(rootPath, pattern);
            complete_path = this.escapeRegExp(complete_path);

            const regex = new RegExp(complete_path, "g");
            if (regex.test(currentPath)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all files recursively from a directory
     * @param workspaceDir The workspace directory. Used to remove common paths from the strings.
     * @param pathsToIgnore The patterns to ignore
     * @param dir The directory to search.
     * @returns An array containing all files in the directory.
     */
    traverseDir(workspaceDir: string, pathsToIgnore: string[], dir: string) {
        var files: string[] = [];
        fs.readdirSync(dir).forEach(async (file) => {
            let fullPath = path.join(dir, file);

            // Check if path should be ignored
            if (this.shouldIgnorePath(workspaceDir, pathsToIgnore, fullPath)) {
                return;
            }

            if (fs.lstatSync(fullPath).isDirectory()) {
                files = files.concat(this.traverseDir(workspaceDir, pathsToIgnore, fullPath));
            } else {
                files.push(fullPath.replace(workspaceDir + path.sep, ""));
            }
        });
        return files;
    }

    async addEntryToGroup(item: any) {
        const validationResult: ValidationResult = validateWorkspace();
        if (validationResult.hasError) {
            vscode.window.showErrorMessage(validationResult.error);
            return;
        }

        let groupLabels: any[] = createQuickPickGroupsOptions(this.m_data, true);

        vscode.window.showQuickPick(groupLabels, {
            canPickMany: false,
            placeHolder: "Select Tab Group",
        })
        .then(async (groupSelection) => {
            if (!groupSelection) return;

            let parent: TreeItem;
            if (groupSelection.label === NEW_GROUP_LABEL) {
                await this.addTabGroup();
                parent = this.m_data[this.m_data.length - 1];
            }
            else {
                let dataIndex = this.getItemIndexByParentLabel(groupSelection.label);
                parent = this.m_data[dataIndex];
            }

            let filePath = normalizePath(validationResult.workspaceDir, item._fsPath);

            const newChild = new TreeItem(filePath, item._fsPath, false);
            newChild.setParentLabel(parent.label?.toString()!);

            parent.add_child(newChild);
            
            this.m_onDidChangeTreeData.fire(undefined);

            // Save the tree to the context
            this.save();
        });
    }

    async addAllOpenTabsToGroup() {
        const validationResult: ValidationResult = validateWorkspace();
        if (validationResult.hasError) {
            vscode.window.showErrorMessage(validationResult.error);
            return;
        }

        let groupLabels: any[] = createQuickPickGroupsOptions(this.m_data, true);

        vscode.window.showQuickPick(groupLabels, {
            canPickMany: false,
            placeHolder: "Select Tab Group",
        })
        .then(async (groupSelection) => {
            if (!groupSelection) return;

            let parent: TreeItem;
            if (groupSelection.label === NEW_GROUP_LABEL) {
                await this.addTabGroup();
                parent = this.m_data[this.m_data.length - 1];
            }
            else {
                let dataIndex = this.getItemIndexByParentLabel(groupSelection.label);
                parent = this.m_data[dataIndex];
            }

            const openFiles = getCurrentlyOpenFiles(validationResult.workspaceDir);

            for(let f of openFiles) {
                let filePath = path.join(validationResult.workspaceDir, f.label);

                const newChild = new TreeItem(f.label, filePath, false);
                newChild.setParentLabel(parent.label?.toString()!);

                parent.add_child(newChild);
            }
            this.m_onDidChangeTreeData.fire(undefined);

            // Save the tree to the context
            this.save();
        });
    }

    /**
     * Sync open tabs order to group order
     */
    async syncOpenTabsGroupOrder() {
        const validationResult: ValidationResult = validateWorkspace();
        if (validationResult.hasError) {
            vscode.window.showErrorMessage(validationResult.error);
            return;
        }

        let groupLabels: any[] = createQuickPickGroupsOptions(this.m_data);

        vscode.window.showQuickPick(groupLabels, {
            canPickMany: false,
            placeHolder: "Select Tab Group",
        })
        .then(async (groupSelection) => {
            if (!groupSelection) return;

            let dataIndex = this.getItemIndexByParentLabel(groupSelection.label);

            if (this.m_data[dataIndex].children.length == 0) {
                vscode.window.showErrorMessage(`Can not reorder elements in group '${groupSelection.label}' because it has no elements.`);
                return;
            }
            else if (this.m_data[dataIndex].children.length == 1) {
                // No need to do anything
                return;
            }

            const openFiles = getCurrentlyOpenFiles(validationResult.workspaceDir);

            if (!this.m_data[dataIndex].children.some(elem => openFiles.some(file => file.label === elem.label))) {
                vscode.window.showErrorMessage(`No tabs from group '${groupSelection.label}' are open in the editor.`);
                return;
            }

            let newOrder: TreeItem[] = [];

            for(let f of openFiles) {
                const elemInGroup = this.m_data[dataIndex].children.find(elem => elem.label === f.label);

                if (elemInGroup) {
                    newOrder.push(elemInGroup);
                }
            }

            // after ordering the open tabs, add the tabs that are not open
            const elemsNotInNewGroup = this.m_data[dataIndex].children.filter(elem => !newOrder.some(newOrderElem => newOrderElem.label === elem.label));
            newOrder = newOrder.concat(elemsNotInNewGroup);

            this.m_data[dataIndex].children = newOrder;

            this.m_onDidChangeTreeData.fire(undefined);

            // Save the tree to the context
            this.save();
        });
    }

    /**
     * Add an entry to a parent item.
     * @param parent The parent item.
     */
    async addChildToItem(parent: TreeItem) {
        const validationResult: ValidationResult = validateWorkspace();
        if (validationResult.hasError) {
            vscode.window.showErrorMessage(validationResult.error);
            return;
        }

        var quickPickItems: any[] = [];

        // Get labels of all open tabs
        quickPickItems = quickPickItems.concat(getCurrentlyOpenFiles(validationResult.workspaceDir));

        if (quickPickItems.length > 0) {
            // make a separator for the 'Open Tabs' group
            const tabsSeparator = {
                label: "Open Tabs",
                kind: vscode.QuickPickItemKind.Separator, // this is new
            };

            // put the 'Open Tabs' separator at the beginning
            quickPickItems.unshift(tabsSeparator);
        }

        const ignorePaths: string[] | undefined = vscode.workspace.getConfiguration("vs-tab-groups").get("ignorePaths");
        const allFiles = this.traverseDir(validationResult.workspaceDir, ignorePaths ? ignorePaths : [], validationResult.workspaceDir);

        if (allFiles.length > 0) {
            // make a separator for the 'File' group
            const fileSeparator = {
                label: "All Files",
                kind: vscode.QuickPickItemKind.Separator,
            };

            quickPickItems.push(fileSeparator);

            allFiles.forEach((fName) => quickPickItems.push({ label: fName }));
        }

        // Display the selection box
        const filesSelections = await vscode.window.showQuickPick(quickPickItems, {
            canPickMany: true,
            placeHolder: "Select files",
        });

        // Add to tree if something was selected
        if (filesSelections) {
            for (let selectionObj of filesSelections) {
                const label = selectionObj["label"];
                const file_path = validationResult.workspaceDir + path.sep + label;

                const newChild = new TreeItem(label, file_path, false);
                if (parent.label) {
                    newChild.setParentLabel(parent.label?.toString());
                }

                parent?.add_child(newChild);
            }
            this.m_onDidChangeTreeData.fire(undefined);

            // Save the tree to the context
            this.save();
        }
    }

    /**
     * Open the tab group, i.e., all files in the group, in the editor.
     * @param item The item that represents the root of the group.
     */
    async openTabGroup(item: TreeItem) {
        // Check if the user wants the other tabs to be closed when opening a new group
        if (vscode.workspace.getConfiguration("vs-tab-groups").get("closeTabsOnOpenGroup")) {
            // close every open tab
            await vscode.commands.executeCommand("workbench.action.closeAllEditors");
        }

        // Open the editor for every child of this tree
        for (let child of item.children) {
            this.openEditor(child.file);
        }
    }

    /**
     * Close the tab group, i.e., all files in the group, in the editor.
     * @param item The item that represents the root of the group.
     */
    closeTabGroup(item: TreeItem) {
        var file_paths: string[] = [];
        for (let child of item.children) {
            if (child.file) {
                file_paths.push(child.file);
            }
        }
        this.closeEditor(file_paths);
    }

    /**
     * Change the icon of the group's root.
     * @param item The item representing the root of the group.
     */
    async editTabGroupIcon(item: TreeItem) {
        const defaultEmojis = ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜"];
        const icons = ["red", "orange", "yellow", "green", "blue", "purple", "brown", "black", "white"];

        const iconSelection = await vscode.window.showQuickPick(defaultEmojis, {
            canPickMany: false,
            placeHolder: "Select icon",
        });

        if (iconSelection) {
            var index: number = defaultEmojis.indexOf(iconSelection, 0);

            const p: string = path.join(__filename, "..", "..", "resources", `${icons[index]}_square.png`);
            item.iconPath = { light: p, dark: p };

            this.m_onDidChangeTreeData.fire(undefined);
        }
    }

    /**
     * Change the name of the group's root.
     * @param item The item representing the root of the group.
     */
    async editTabGroupName(item: TreeItem) {
        const input = await vscode.window.showInputBox({
            prompt: "Type in the new name of the tab group.\n",
        });

        if (input && input !== "") {
            if (this.labelExists(input)) {
                vscode.window.showErrorMessage(`Can not have two tab groups with name '${input}'`);
                return;
            }

            item.label = input
            this.m_onDidChangeTreeData.fire(undefined);
        }
        this.save();
    }

    /**
     * Removes the tab group from the tree
     * @param item The item representing the root of the group.
     */
    removeTabGroup(item: TreeItem) {
        var index: number = this.m_data.indexOf(item, 0);
        if (index <= -1) return;

        vscode.window.showInformationMessage(`Are you sure you want to remove group '${item.label}'?`, "Yes", "No")
        .then((answer) => {
            if (answer === "Yes") {
                this.m_data.splice(index, 1);
                this.m_onDidChangeTreeData.fire(undefined);

                // Save the tree to the context
                this.save();
            }
        });
    }

    /*** LOW LEVEL ***/

    private findParentOfItem(item: TreeItem): TreeItem[] {
        if (item.isRoot) {
            return this.m_data;
        }
        return this.m_data.filter(e => e.label === item.parentLabel)[0].children;
    }

    private array_move(arr: any[], old_index: number, new_index: number): any[] {
        arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
        return arr;
    };

    moveItemUp(item: TreeItem): void {
        const parent = this.findParentOfItem(item);
        const index = parent.indexOf(item);

        if (index <= 0) {
            vscode.window.showErrorMessage(`Can't move this item up.`);
            return;
        }
        this.array_move(parent, index, index - 1);

        this.treeView?.reveal(item);

        this.m_onDidChangeTreeData.fire(undefined);
        this.save();
    }

    moveItemDown(item: TreeItem): void {
        const parent = this.findParentOfItem(item);
        const index = parent.indexOf(item);

        if (index === parent.length - 1) {
            vscode.window.showErrorMessage(`Can't move this item down.`);
            return;
        }
        this.array_move(parent, index, index + 1);

        this.treeView?.reveal(item);

        this.m_onDidChangeTreeData.fire(undefined);
        this.save();
    }

    /**
     * Open a tab in the editor.
     * @param item The item representing the file to be opened.
     */
    openTab(item: TreeItem) {
        this.openEditor(item.file);
    }

    /**
     * Close a tab in the editor.
     * @param item The item representing the file to be closed.
     */
    closeTab(item: TreeItem) {
        if (item.file) {
            this.closeEditor([item.file]);
        }
    }

    /**
     * Remove a tab/file from the group.
     * @param item The item representing the file to be removed from the group.
     */
    removeTab(item: TreeItem) {
        // Loop through every group in the tree
        for (let tab_group of this.m_data) {
            // If the group is not the parent of the item, continue
            if (tab_group.label !== item.parentLabel) {
                continue;
            }
            // Find the index of the item in the group's children
            var index: number = tab_group.children.indexOf(item, 0);
            if (index > -1) {
                tab_group.children.splice(index, 1);

                this.m_onDidChangeTreeData.fire(undefined);

                // Save the tree to the context
                this.save();

                break;
            }
        }
    }

    /*** GENERAL ***/

    /**
     * Gets an open document for a file or opens a new one and returns it
     * @param filePaths The paths of the files to open
     * @returns An array of TextDocument with the documents for each of the file paths provided
     */
    async getOpenDocuments(filePaths: string[]) {
        var docs: vscode.TextDocument[] = [];

        filePaths.forEach(async (fpath) => {
            var found = false;
            vscode.workspace.textDocuments.forEach((doc) => {
                if (doc.fileName === fpath) {
                    docs.push(doc);
                    found = true;
                    return;
                }
            });

            if (!found) {
                docs.push(await vscode.workspace.openTextDocument(fpath));
            }
        });
        return docs;
    }

    /**
     * Open a file in the editor
     * @param filePath The path of the file to be opened.
     */
    async openEditor(filePath: string | null) {
        if (filePath === null || filePath === undefined) {
            return;
        }

        this.getOpenDocuments([filePath])
            .then((documents) => {
                if (documents.length > 0) {
                    vscode.window
                        .showTextDocument(documents[0], { preview: false })
                        .then()
                        .then(undefined, (err) => {
                            // This is most likely not a problem that needs solving.
                            // An error is thrown when multiple files are being opened at the same time
                            //console.error('An error has occurred while trying to show file :: ', err);
                            //vscode.window.showErrorMessage(`Failed to show document '${filePath}'.`);
                        });
                }
            })
            .then(undefined, (err) => {
                //console.error('An error has occurred while trying to open file :: ', err);
                vscode.window.showErrorMessage(`Failed to open document '${filePath}'.`);
            });
    }

    /**
     * Gets the documents that have tabs open in the editor
     * @param filePaths An array with the paths of files to check for
     * @returns An array of TextDocument that are open in tabs
     */
    getOpenDocmentsInWorkSpace(filePaths: string[] | null) {
        if (!filePaths) {
            return undefined;
        }

        var editorTabs: string[] = [];

        // Find all open tabs
        vscode.window.tabGroups.all.forEach((group) =>
            group.tabs.forEach((tab) => {
                if (!(tab.input instanceof vscode.TabInputText)) {
                    return;
                }

                // Check if the tab is in the paths
                if (filePaths.indexOf(tab.input.uri.fsPath) > -1) {
                    editorTabs.push(tab.input.uri.fsPath);
                }
            })
        );

        // None of the files is open in a tab
        if (editorTabs.length === 0) {
            return undefined;
        }

        return this.getOpenDocuments(editorTabs);
    }

    /**
     * Close files in the editor
     * @param filePaths An array with the paths of the files to be closed.
     */
    async closeEditor(filePaths: string[] | null) {
        var documents = await this.getOpenDocmentsInWorkSpace(filePaths);
        if (!documents || documents.length === 0) {
            return;
        }

        for (let doc of documents) {
            await vscode.window.showTextDocument(doc, {
                preview: true,
                preserveFocus: false,
            });
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }
    }

    /**
     * Open the clicked tab/file in the editor.
     * @param item The item representing the tab/file that was clicked.
     */
    item_clicked(item: TreeItem) {
        if (!item.isRoot) {
            this.openEditor(item.file);
        }
    }

}
