import { window, workspace, QuickPickItemKind, TabInputText } from "vscode";
import { URI } from "vscode-uri";
import { sep } from "path";
import { TreeItem } from "./TreeItem";

export const EXTENSION_ID = "vs_tab_groups";
export const NEW_GROUP_LABEL = "Create New Group";

export interface ValidationResult {
    hasError: boolean
    error: string;
    workspaceDir: string;
}

export function validateWorkspace(): ValidationResult {
    if (!window.activeTextEditor) {
        return { hasError: true, error: `Could not find an open editor. Try to open a file first.`, workspaceDir: "" };
    }
    const currentWorkSpace = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
    if (!currentWorkSpace) {
        return { hasError: true, error: `No workspace has been found.`, workspaceDir: "" };
    }
    return { hasError: false, error: "", workspaceDir: currentWorkSpace.uri.fsPath };
}

export function createQuickPickGroupsOptions(groupsList: TreeItem[]): any[] {
    let groupLabels: any[] = [];
    groupsList.forEach((element) => groupLabels.push({ label: element.label }));

    const fileSeparator = { kind: QuickPickItemKind.Separator };
    groupLabels.push(fileSeparator);
    groupLabels.push({label: NEW_GROUP_LABEL});

    return groupLabels;
}

export function normalizePath(workDir: string, fileDir: string): string {
    let p1 = URI.parse(workDir);
    let p2 = URI.parse(fileDir);

    let filePath = p2.path.replace(p1.path, "");

    if (filePath.startsWith('/') || filePath.startsWith('\\')) {
        filePath = filePath.substring(1)
    }
    return filePath;
}

export function getCurrentlyOpenFiles(workspaceDir: string) {
    var result: any[] = [];
    window.tabGroups.all.forEach((group) =>
        group.tabs.forEach((tab) => {
            var label = tab.label;
            if (tab.input instanceof TabInputText) {
                label = tab.input.uri.fsPath;
                label = label.replace(workspaceDir + sep, "");
            }
            result.push({ label: label });
        })
    );
    return result;
}