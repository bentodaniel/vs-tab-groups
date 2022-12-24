import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path';

export namespace vstg
{
    class tree_item extends vscode.TreeItem 
    {
        readonly parent: tree_item | null;
        readonly file: string | null;

        public children: tree_item[] = [];

        constructor(label: string, file: string | null, parent: tree_item | null) 
        {
            super(label, vscode.TreeItemCollapsibleState.None);
            this.parent = parent;
            this.file = file;
            this.collapsibleState = !parent ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
            this.iconPath = !parent ? undefined : vscode.ThemeIcon.File
        }

        public isRoot() 
        {
            return this.parent === null || this.parent === undefined
        }

        public get_child(child : tree_item)
        {
            for(let item of this.children) {
                if (item.label === child.label && item.file === child.file) {
                    return item;
                }
            }
            return undefined;
        }

        public has_child(child : tree_item)
        {
            return this.get_child(child) !== undefined
        }

        public add_child (child : tree_item) 
        {
            // Only add if this object has no parent (i.e., is a root)
            if (this.isRoot()) {
                this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

                // if there is already this child, ignore
                const other = this.get_child(child)
                if (other) {
                    vscode.window.showWarningMessage(`File with path '${other.file}' has already been added to this group.`);
                }
                else {
                    this.children.push(child);
                }
            }
        }

        public setIcon(icon_path: string) 
        {
            this.iconPath = { light: icon_path, dark: icon_path }
        }
    }
    
    export class tree_view implements vscode.TreeDataProvider<tree_item>
    {
        // m_data holds all tree items 
        private m_data : tree_item [] = [];
        // with the vscode.EventEmitter we can refresh our  tree view
        private m_onDidChangeTreeData: vscode.EventEmitter<tree_item | undefined> = new vscode.EventEmitter<tree_item | undefined>();
        // and vscode will access the event by using a readonly onDidChangeTreeData (this member has to be named like here, otherwise vscode doesnt update our treeview.
        readonly onDidChangeTreeData ? : vscode.Event<tree_item | undefined> = this.m_onDidChangeTreeData.event;
        
        // we register two commands for vscode, item clicked (we'll implement later) and the refresh button.
        constructor() 
        {
            // Top level, add a new group
            vscode.commands.registerCommand('vs_tab_groups.addTabGroup', () => this.addTabGroup());

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

        public getTreeItem(item: tree_item): vscode.TreeItem|Thenable<vscode.TreeItem> {
            let title = item.label ? item.label.toString() : "";
            let result = new vscode.TreeItem(title, item.collapsibleState);
            // here we add our command which executes our memberfunction
            result.command = { command: 'vs_tab_groups.item_clicked', title : title, arguments: [item] };
            result.contextValue = item.isRoot() ? "vstg_root_item" : "vstg_child_item";
            result.iconPath = item.iconPath
            return result;
        }
        
        public getChildren(element : tree_item | undefined): vscode.ProviderResult<tree_item[]> 
        {
            if (element === undefined) {
                return this.m_data;
            } else {
                return element.children;
            }
        }

        /*** TOP LEVEL ***/

        public labelExists(label: string) : boolean 
        {
            for (let item of this.m_data) {
                if (item.label === label) {
                    return true;
                }
            }
            return false;
        }
    
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
				this.m_data.push(new tree_item(input, null, null));
                this.m_onDidChangeTreeData.fire(undefined);
			}
        }

        /*** MID LEVEL ***/

        traverseDir(workspaceDir: string, dir: string) {
            var files: string[] = [];
            fs.readdirSync(dir).forEach(async (file) => {
                let fullPath = path.join(dir, file);
                if (fs.lstatSync(fullPath).isDirectory()) {
                    files = files.concat( this.traverseDir(workspaceDir ,fullPath));
                } else {
                    files.push( fullPath.replace(workspaceDir, "") );
                }  
            })
            return files
        }

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

            const allFiles = this.traverseDir(workspaceDir + path.sep, workspaceDir)

            if (allFiles.length > 0) {
                // make a separator for the 'File' group
                const fileSeparator = {
                    label: 'All Files',
                    kind: vscode.QuickPickItemKind.Separator
                };

                quickPickItems.push(fileSeparator);

                allFiles.forEach(fName => quickPickItems.push( {"label": fName} ))
            }

            const filesSelections = await vscode.window.showQuickPick(quickPickItems, {
                canPickMany: true,
                placeHolder: "Select files"
            });

            if (filesSelections) {
                // Add to tree
                for (let selectionObj of filesSelections) {
                    const label = selectionObj["label"];
                    const file_path = workspaceDir + path.sep + label;
                    item?.add_child(new tree_item(label, file_path, item));
                }
                this.m_onDidChangeTreeData.fire(undefined);
            }
        }

        openTabGroup(item: tree_item)
        {
            for (let child of item.children) {
                this.openEditor(child.file)
            }
        }

        closeTabGroup(item: tree_item)
        {

        }

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
                item.setIcon(p)

                this.m_onDidChangeTreeData.fire(undefined);
            }
        }

        removeTabGroup(item: tree_item)
        {
            var index: number = this.m_data.indexOf(item, 0);
            if (index > -1) {
                this.m_data.splice(index, 1);
            }
            this.m_onDidChangeTreeData.fire(undefined);
        }

        /*** LOW LEVEL ***/
        
        openTab(item: tree_item)
        {
            this.openEditor(item.file)
        }

        closeTab(item: tree_item)
        {

        }

        removeTab(item: tree_item)
        {
            /*
            if (!item.isRoot() && item.parent) {
                const p_index: number = this.m_data.indexOf(item.parent, 0);
                index = this.m_data[p_index].children.indexOf(item, 0);
                data_origin = this.m_data[p_index].children
            }
            */
        }

        /*** GENERAL ***/

        openEditor(filePath: string | null) {
            if (filePath === null || filePath === undefined) {
                return;
            }
            vscode.workspace.openTextDocument(filePath)
            .then( document => {
                // after opening the document, we set the cursor 
                // and here we make use of the line property which makes imo the code easier to read
                vscode.window.showTextDocument(document, {preview: false});
            })
            .then(undefined, err => {
                console.error('An error has occurred :: ', err);
            });
        }

        // only open editor if it is not a root
        item_clicked(item: tree_item) {
            if (!item.isRoot()) {
                this.openEditor(item.file)
            }
        }
    }
}