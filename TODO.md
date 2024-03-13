# VS Tab Groups
Create and manage tab groups to improve your development workflow.

---

## Features

### Extension Settings
- [x] Control whether all open tabs should be replaced when opening a new tab group
- [x] Exclude certain folders from add file to group

### WorkSpace Context
- [x] Save state of the workspace
- [x] Load previous state of the workspace

### Actions on Tabs and Groups
- [x] Create tab groups
- [x] Remove all tab groups

- [x] Add tabs/files to a tab group
- [x] Open a tab group in the editor
- [x] Close tab groups
- [x] Change the icon of a tab group for easier identification
- [x] Remove a tab group
  
- [x] Open a tab
- [x] Close tabs
- [x] Remove a tab/file from group

- [x] Open a tab/file when clicked 

### Extension Tests
- [ ] Create tests for the extension
  * [x] Test TreeItem
  * [ ] Test tree_view

### Misc
- [ ] Create release notes
- [x] Update ReadMe

---

## Bugs

### Add items
- [x] On startup, not all open tabs will be displayed as open. Vscode needs to register that they are open.

### Open files
- [x] When opening a file/group, sometimes an error is thrown

### Close tabs
- [x] When closing a group, the last tab is not closed, but can be closed when closing files individually
- [x] Closing a tab that is closed, will make the tab pop up and then be closed if the file was opened previously
- [x] Can not close tabs that are open on startup without re-opening them
