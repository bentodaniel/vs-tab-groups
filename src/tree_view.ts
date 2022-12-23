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

        constructor(label: string, file: string | null, parent: tree_item | null) {
            super(label, vscode.TreeItemCollapsibleState.None);
            this.parent = parent;
            this.file = file;
            this.collapsibleState = !parent ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        }

        public isRoot() {
            return this.parent === null || this.parent === undefined
        }

        public add_child (child : tree_item) {
            // Only add if this object has no parent (i.e., is a root)
            if (this.isRoot()) {
                this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                this.children.push(child);
            }
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
            vscode.commands.registerCommand('vs_tab_groups.addTabGroup', () => this.addTabGroup());
            vscode.commands.registerCommand('vs_tab_groups.removeTabGroup', (item) => this.removeTabGroup(item));
            vscode.commands.registerCommand('vs_tab_groups.addEntry', (item) => this.addEntry(item));
            vscode.commands.registerCommand('vs_tab_groups.item_clicked', (item) => this.item_clicked(item));
        }

        public getTreeItem(item: tree_item): vscode.TreeItem|Thenable<vscode.TreeItem> {
            let title = item.label ? item.label.toString() : "";
            let result = new vscode.TreeItem(title, item.collapsibleState);
            // here we add our command which executes our memberfunction
            result.command = { command: 'vs_tab_groups.item_clicked', title : title, arguments: [item] };
            result.contextValue = item.isRoot() ? "vstg_root_item" : "vstg_child_item";
            return result;
        }
        
        public getChildren(element : tree_item | undefined): vscode.ProviderResult<tree_item[]> {
            if (element === undefined) {
                return this.m_data;
            } else {
                return element.children;
            }
        }

        public labelExists(label: string) : boolean {
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

        removeTabGroup(item: tree_item)
        {
            var index: number = this.m_data.indexOf(item, 0);
            var data_origin = this.m_data

            if (!item.isRoot() && item.parent) {
                const p_index: number = this.m_data.indexOf(item.parent, 0);
                index = this.m_data[p_index].children.indexOf(item, 0);
                data_origin = this.m_data[p_index].children
            }

            if (index > -1) {
                data_origin.splice(index, 1);
            }
            this.m_onDidChangeTreeData.fire(undefined);
        }

        traverseDir(dir: string) {
            var files: string[] = [];
            fs.readdirSync(dir).forEach(async (file) => {
                let fullPath = path.join(dir, file);
                if (fs.lstatSync(fullPath).isDirectory()) {
                    files = files.concat( this.traverseDir(fullPath));
                } else {
                    files.push(fullPath);
                }  
            })
            return files
        }

        async addEntry(item: tree_item)
        {
            if (!vscode.window.activeTextEditor) {
                return
            }
            const currentWorkSpace = await vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
            if (!currentWorkSpace) {
                return
            }

            const allFiles = this.traverseDir(currentWorkSpace.uri.fsPath)

            const filesSelections = await vscode.window.showQuickPick(allFiles, {
                canPickMany: true,
                placeHolder: "Select files"
            });

            if (filesSelections) {
                // Add to tree
                for (let path of filesSelections) {
                    item?.add_child(new tree_item(path, path, item));
                }
                this.m_onDidChangeTreeData.fire(undefined);
            }
        }

        openEditor(filePath: string | null) {
            if (filePath === null || filePath === undefined) {
                return;
            }
            vscode.workspace.openTextDocument(filePath).then( document => {
                // after opening the document, we set the cursor 
                // and here we make use of the line property which makes imo the code easier to read
                vscode.window.showTextDocument(document).then( editor => {});
            });
        }

        // this is called when we click an item
        item_clicked(item: tree_item) {
            if (item.isRoot()) {
                // TODO - we need to open every child element
            }
            else {
                this.openEditor(item.file)
            }
        }
    }
}