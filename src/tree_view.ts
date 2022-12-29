import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path';

export namespace vstg
{
    /**
     * The tree item class. Represents an item in the explorer tree.
     */
    export class tree_item extends vscode.TreeItem 
    {
        readonly isRoot: boolean;
        readonly file: string | null;

        public children: tree_item[] = [];
        public parentLabel: string | undefined = undefined;

        /**
         * Create a new item
         * @param label The label to be displayed
         * @param file The file this item references
         * @param isRoot A boolean identifying the item as a root or a child
         */
        constructor(label: string, file: string | null, isRoot: boolean) 
        {
            super(label, vscode.TreeItemCollapsibleState.None);
            this.isRoot = isRoot;
            this.file = file;
            this.collapsibleState = isRoot ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
            this.iconPath = isRoot ? undefined : vscode.ThemeIcon.File
        }

        /**
         * Set the parent's label.
         * @param pLabel The parent's label
         */
        public setParentLabel(pLabel: string) 
        {
            if (this.isRoot) {
                throw new Error('Cannot assign parentLabel to a root object.');
            }
            this.parentLabel = pLabel;
        }

        /**
         * Get a child's index from this tree that matches a given item
         * @param other The item to use as comparison
         * @returns The child that matches the given item, or undefined.
         */
        public get_child_index(other : tree_item)
        {
            let i = 0;
            for(let item of this.children) {
                if (item.label === other.label && item.file === other.file) {
                    return i;
                }
                i += 1;
            }
            return -1;
        }

        /**
         * Check if this item has a child that matches a given item
         * @param other The item to be checked for
         * @returns True if this item has a child that matches the given object, or false if otherwise
         */
        public has_child(other : tree_item)
        {
            return this.get_child_index(other) > -1
        }

        /**
         * Add a child to this item
         * @param other The item to be added
         */
        public add_child (other : tree_item) 
        {
            // Only add if this object is a root
            if (!this.isRoot) {
                throw new Error('Can not add child to child item.');
            }

            this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

            // if there is already this child, ignore
            const index = this.get_child_index(other)
            if (index > -1) {
                vscode.window.showWarningMessage(`File with path '${other.file}' has already been added to this group.`);
            }
            else {
                this.children.push(other);
            }
        }

        /**
         * Remove a child from this item
         * @param other The item to be removed
         * @returns True if the child was removed. False otherwise
         */
        public remove_child (other : tree_item) 
        {

            // TODO

            return false
        }

        /**
         * Convert this item into JSON data
         * @returns This item's data as a JSON
         */
        public async toJSON()
        {
            var childrenData: any = {}

            // loop the data in this tree and pass it all to json format
            for (let i = 0; i < this.children.length; i++) {
                const childJSON = await this.children[i].toJSON();
                childrenData[`key_${i}`] = childJSON;
            }

            return {
                label: this.label,
                file: this.file,
                isRoot: this.isRoot,
                iconPath: this.iconPath,
                children: childrenData,
                parentLabel: this.parentLabel
            }
        }

        /**
         * Convert JSON formatted data into a tree item object
         * @param data The data to be parsed
         * @returns A new tree_item object
         */
        public static async fromJSON(data: any)
        {
            const label = data["label"];
            const file_path = data["file"];
            const isRoot = data["isRoot"];
            
            const item = new tree_item(label, file_path, isRoot);

            if (isRoot && "iconPath" in data){
                item.iconPath =  data["iconPath"]
            }

            if (!isRoot && "parentLabel" in data){
                item.setParentLabel( data["parentLabel"] )
            }

            for (let key in data["children"]) {
                let objValue = data["children"][key];
                const child = await tree_item.fromJSON(objValue);
                item.add_child( child )
            }

            return item
        }
    }

    /****************************************************
    ****************************************************/
    
    /**
     * The tree view class. Represents the explorer tree.
     */
    export class tree_view implements vscode.TreeDataProvider<tree_item>
    {
        private readonly context: vscode.ExtensionContext;
        // m_data holds all tree items 
        private m_data : tree_item [] = [];
        // with the vscode.EventEmitter we can refresh our  tree view
        private m_onDidChangeTreeData: vscode.EventEmitter<tree_item | undefined> = new vscode.EventEmitter<tree_item | undefined>();
        // and vscode will access the event by using a readonly onDidChangeTreeData (this member has to be named like here, otherwise vscode doesnt update our treeview.
        readonly onDidChangeTreeData ? : vscode.Event<tree_item | undefined> = this.m_onDidChangeTreeData.event;
        
        /**
         * Create a new tree view.
         * Register all the commands available for this tree.
         * @param context The context of the extension
         */
        constructor(context: vscode.ExtensionContext) 
        {
            this.context = context;

            // Top level, add a new group
            vscode.commands.registerCommand('vs_tab_groups.addTabGroup', () => this.addTabGroup());
            vscode.commands.registerCommand('vs_tab_groups.removeAllGroups', () => this.removeAllGroups());

            // Mid level, actions on tab groups
            vscode.commands.registerCommand('vs_tab_groups.addEntry', (item) => this.addEntry(item));
            vscode.commands.registerCommand('vs_tab_groups.openTabGroup', (item) => this.openTabGroup(item));
            vscode.commands.registerCommand('vs_tab_groups.closeTabGroup', (item) => this.closeTabGroup(item));
            vscode.commands.registerCommand('vs_tab_groups.editTabGroupIcon', (item) => this.editTabGroupIcon(item));
            vscode.commands.registerCommand('vs_tab_groups.removeTabGroup', (item) => this.removeTabGroup(item));
            
            // Low level, actions on tabs
            vscode.commands.registerCommand('vs_tab_groups.openTab', (item) => this.openTab(item));
            vscode.commands.registerCommand('vs_tab_groups.closeTab', (item) => this.closeTab(item));
            vscode.commands.registerCommand('vs_tab_groups.removeTab', (item) => this.removeTab(item));

            // General
            vscode.commands.registerCommand('vs_tab_groups.item_clicked', (item) => this.item_clicked(item));
        }

        /**
         * Save this tree in the workspace.
         */
        public async save()
        {
            var treeData: any = {}

            // loop the data in this tree and pass it all to json format
            for (let i = 0; i < this.m_data.length; i++) {
                const itemJSON = await this.m_data[i].toJSON();
                treeData[`key_${i}`] = itemJSON;
            }

            this.context.workspaceState.update('treeData', treeData)
        }
        
        /**
         * Load a tree from the workspace.
         */
        public async load()
        {
            const treeData: any = this.context.workspaceState.get('treeData')

            for (let key in treeData) {
                let objValue = treeData[key];
                const item = await tree_item.fromJSON(objValue)
                this.m_data.push( item )
            }

            this.m_onDidChangeTreeData.fire(undefined);
        }

        /**
         * @inheritDoc
         */
        public getTreeItem(item: tree_item): vscode.TreeItem|Thenable<vscode.TreeItem>
        {
            let title = item.label ? item.label.toString() : "";
            let result = new vscode.TreeItem(title, item.collapsibleState);
            // here we add our command which executes our memberfunction
            result.command = { command: 'vs_tab_groups.item_clicked', title : title, arguments: [item] };
            result.contextValue = item.isRoot ? "vstg_root_item" : "vstg_child_item";
            result.iconPath = item.iconPath
            return result;
        }
        
        /**
         * @inheritDoc
         */
        public getChildren(element : tree_item | undefined): vscode.ProviderResult<tree_item[]> 
        {
            if (element === undefined) {
                return this.m_data;
            } else {
                return element.children;
            }
        }

        /*** TOP LEVEL ***/

        /**
         * Check if a label already exists for a parent of this tree
         * @param label The label to check for
         * @returns True if an item already uses this label, false if otherwise.
         */
        labelExists(label: string) : boolean 
        {
            for (let item of this.m_data) {
                if (item.label === label) {
                    return true;
                }
            }
            return false;
        }
    
        /**
         * Create a new group of tabs.
         */
        async addTabGroup()
        {
            const input = await vscode.window.showInputBox({
				prompt:"Type in the name of the tab group to be created.\n"
			});		
			
			if (input && input !== "") {
                if (this.labelExists(input)) {
                    vscode.window.showErrorMessage(`Can not have two tab groups with name '${input}'`);
                    return
                }
				this.m_data.push(new tree_item(input, null, true));
                this.m_onDidChangeTreeData.fire(undefined);
			}

            this.save()
        }

        /**
         * Remove all groups of tabs. Fully clears the tree.
         */
        removeAllGroups()
        {
            vscode.window
            .showInformationMessage("Are you sure you want to remove all groups?", "Yes", "No")
            .then(answer => {
                if (answer === "Yes") {
                    this.m_data = [];
                    this.m_onDidChangeTreeData.fire(undefined);
			
                    this.save()
                }
            })
        }

        /*** MID LEVEL ***/

        /**
         * Escape a string path pattern
         * @param s A string representing a path
         * @returns The path string in a format that is usable in a regex
         */
        escapeRegExp(s: string) {
            s = s.replace(/\\/g, '\\\\');   // escape all backslashes
            s = s.replace(/\./g, '\\.');    // escape all dots
            s = s.replace(/\//g, '\\\/');   // escape all forward slashes
            s = s.replace(/\*/g, '.*');     // when used *, the user means anything, i.e., .*
            return s
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
                var complete_path = path.join(rootPath, pattern)
                complete_path = this.escapeRegExp(complete_path)

                const regex = new RegExp(complete_path, 'g')
                if (regex.test(currentPath)) {
                    return true
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
                if (this.shouldIgnorePath(workspaceDir, pathsToIgnore, fullPath)){
                    return
                }

                if (fs.lstatSync(fullPath).isDirectory()) {
                    files = files.concat( this.traverseDir(workspaceDir, pathsToIgnore, fullPath));
                    
                } else {
                    files.push( fullPath.replace(workspaceDir + path.sep, "") );
                }  
            })
            return files
        }

        /**
         * Add an entry to a parent item.
         * @param item The parent item.
         */
        async addEntry(item: tree_item)
        {
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage(`Could not find an open editor. Try to open a file first.`);
                return
            }
            const currentWorkSpace = await vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
            if (!currentWorkSpace) {
                vscode.window.showErrorMessage(`No workspace has been found.`);
                return
            }
            const workspaceDir = currentWorkSpace.uri.fsPath;

            // Get labels of opened files in all groups
            var quickPickItems = []
            for (const document of vscode.workspace.textDocuments) {
                quickPickItems.push( {"label" : document.fileName.replace(workspaceDir + path.sep, "")} );
            }

            if (quickPickItems.length > 0) {
                // make a separator for the 'Open Tabs' group
                const tabsSeparator = {
                    label: 'Open Tabs',
                    kind: vscode.QuickPickItemKind.Separator  // this is new
                };

                // put the 'Open Tabs' separator at the beginning 
                quickPickItems.unshift(tabsSeparator);
            }

            const ignorePaths: string[] | undefined = vscode.workspace.getConfiguration('vs-tab-groups').get('ignorePaths')
            const allFiles = this.traverseDir(
                workspaceDir, 
                ignorePaths ? ignorePaths : [], 
                workspaceDir
            )

            if (allFiles.length > 0) {
                // make a separator for the 'File' group
                const fileSeparator = {
                    label: 'All Files',
                    kind: vscode.QuickPickItemKind.Separator
                };

                quickPickItems.push(fileSeparator);

                allFiles.forEach(fName => quickPickItems.push( {"label": fName} ))
            }

            // Display the selection box
            const filesSelections = await vscode.window.showQuickPick(quickPickItems, {
                canPickMany: true,
                placeHolder: "Select files"
            });

            // Add to tree if something was selected
            if (filesSelections) {
                for (let selectionObj of filesSelections) {
                    const label = selectionObj["label"];
                    const file_path = workspaceDir + path.sep + label;

                    const newChild = new tree_item(label, file_path, false);
                    if (item.label) {
                        newChild.setParentLabel(item.label?.toString())
                    }

                    item?.add_child(newChild);
                }
                this.m_onDidChangeTreeData.fire(undefined);

                // Save the tree to the context
                this.save()
            }
        }

        /**
         * Open the tab group, i.e., all files in the group, in the editor.
         * @param item The item that represents the root of the group.
         */
        async openTabGroup(item: tree_item)
        {
            // Check if the user wants the other tabs to be closed when opening a new group
            if (vscode.workspace.getConfiguration('vs-tab-groups').get('closeTabsOnOpenGroup')) {
                // close every open tab
                await vscode.commands.executeCommand('workbench.action.closeAllEditors')
            }

            // Open the editor for every child of this tree
            for (let child of item.children) {
                this.openEditor(child.file)
            }
        }

        /**
         * Close the tab group, i.e., all files in the group, in the editor.
         * @param item The item that represents the root of the group.
         */
        closeTabGroup(item: tree_item)
        {
            for (let child of item.children) {
                this.closeEditor(child.file)
            }
        }

        /**
         * Change the icon of the group's root.
         * @param item The item representing the root of the group.
         */
        async editTabGroupIcon(item: tree_item)
        {
            const defaultEmojis = ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜"]
            const icons = ["red", "orange", "yellow", "green", "blue", "purple", "brown", "black", "white"]

            const iconSelection = await vscode.window.showQuickPick(defaultEmojis, {
                canPickMany: false,
                placeHolder: "Select icon"
            });

            if (iconSelection) {
                var index: number = defaultEmojis.indexOf(iconSelection, 0);
                
                const p: string = path.join(__filename, '..', '..', 'resources', `${icons[index]}_square.png`)
                item.iconPath = { light: p, dark: p }

                this.m_onDidChangeTreeData.fire(undefined);
            }
        }

        /**
         * Removes the tab group from the tree
         * @param item The item representing the root of the group. 
         */
        removeTabGroup(item: tree_item)
        {
            var index: number = this.m_data.indexOf(item, 0);
            if (index > -1) {
                this.m_data.splice(index, 1);

                this.m_onDidChangeTreeData.fire(undefined);

                // Save the tree to the context
                this.save()
            }
        }

        /*** LOW LEVEL ***/
        
        /**
         * Open a tab in the editor.
         * @param item The item representing the file to be opened.
         */
        openTab(item: tree_item)
        {
            this.openEditor(item.file)
        }

        /**
         * Close a tab in the editor.
         * @param item The item representing the file to be closed.
         */
        closeTab(item: tree_item)
        {
            this.closeEditor(item.file)
        }

        /**
         * Remove a tab/file from the group.
         * @param item The item representing the file to be removed from the group.
         */
        removeTab(item: tree_item)
        {
            // Loop through every group in the tree
            for (let tab_group of this.m_data) {
                // If the group is not the parent of the item, continue
                if (tab_group.label !== item.parentLabel) {
                    continue
                }
                // Find the index of the item in the group's children
                var index: number = tab_group.children.indexOf(item, 0);
                if (index > -1) {
                    tab_group.children.splice(index, 1);

                    this.m_onDidChangeTreeData.fire(undefined);

                    // Save the tree to the context
                    this.save()

                    break
                }
            }
        }

        /*** GENERAL ***/

        /**
         * Open a file in the editor
         * @param filePath The path of the file to be opened.
         */
        openEditor(filePath: string | null)
        {
            if (filePath === null || filePath === undefined) {
                return;
            }
            vscode.workspace.openTextDocument(filePath)
            .then( document => {
                // after opening the document, we set the cursor 
                // and here we make use of the line property which makes imo the code easier to read
                vscode.window.showTextDocument(document, {preview: false});
            })
            //.then(undefined, err => {
                //console.error('An error has occurred :: ', err);
                //vscode.window.showErrorMessage(`Failed to open document '${filePath}'.`);
            //});
        }
        
        findDocmentInWorkSpace(filePath: string | null) {
            if (!filePath) {
                return undefined
            }

            for (let doc of vscode.workspace.textDocuments) {
                if (doc.fileName === filePath) {
                    return doc
                }
            }
            return undefined
        }

        /**
         * Close a file in the editor
         * @param filePath The path of the file to be closed.
         */
        closeEditor(filePath: string | null)
        {
            var document = this.findDocmentInWorkSpace(filePath);
            if (!document) {
                return
            }

            vscode.window.showTextDocument(document.uri, {preview: true, preserveFocus: false})
            .then(() => {
                return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            });
        }

        /**
         * Open the clicked tab/file in the editor.
         * @param item The item representing the tab/file that was clicked.
         */
        item_clicked(item: tree_item) {
            if (!item.isRoot) {
                this.openEditor(item.file)
            }
        }
    }
}