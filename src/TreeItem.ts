import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path';

/**
 * The tree item class. Represents an item in the explorer tree.
 */
export class TreeItem extends vscode.TreeItem 
{
    readonly isRoot: boolean;
    readonly file: string | null;

    public children: TreeItem[] = [];
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
    public get_child_index(other : TreeItem)
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
    public has_child(other : TreeItem)
    {
        return this.get_child_index(other) > -1
    }

    /**
     * Add a child to this item
     * @param other The item to be added
     */
    public add_child (other : TreeItem) 
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
    public remove_child (other : TreeItem) 
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
     * @returns A new TreeItem object
     */
    public static async fromJSON(data: any)
    {
        const label = data["label"];
        const file_path = data["file"];
        const isRoot = data["isRoot"];
        
        const item = new TreeItem(label, file_path, isRoot);

        if (isRoot && "iconPath" in data){
            item.iconPath =  data["iconPath"]
        }

        if (!isRoot && "parentLabel" in data){
            item.setParentLabel( data["parentLabel"] )
        }

        for (let key in data["children"]) {
            let objValue = data["children"][key];
            const child = await TreeItem.fromJSON(objValue);
            item.add_child( child )
        }

        return item
    }
}