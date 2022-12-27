# vs-tab-groups

Create and manage tab groups to improve your development workflow.

## Features

- Create file groups
- Remove file groups
- Add files to a group
- Remove files from a group
- Open a group, i.e., all associated files, in the editor
- Close a group of files previously opened in the editor
- Save the workspace's tab groups, so you have them ready when you come back to your work.

\!\[feature X\]\(screenshots/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Extension Settings

This extension contributes the following settings:

* `vs-tab-groups.replaceTabGroups`: If true, when opening a tab group, all other open tab groups in the editor will be replaced. If false, the new tab group will be opened, keeping all other tabs in the editor.
* `vs-tab-groups.ignorePaths`: Configure patterns to ignore files and folders when adding files to groups.

## Known Issues

- Must open a folder to create groups. It is not possible to create groups of individual files.
- When trying to add files to a group, a tab must be opened. VSCode uses this tab's file path to identify the path to the open folder.

## Release Notes

### 1.0.0

Initial release of `VS Tab Groups`

---

**Hope you find this extension useful!**
