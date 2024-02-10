const vscode = require("vscode");

async function getReactProjectDirFromUser() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage(
      "No workspace is opened. Please open a workspace first."
    );
    return null;
  }

  const folderName = await vscode.window.showInputBox({
    prompt: "Enter the relative folder name of your React project:",
    placeHolder: "e.g., src or my-app/src",
  });

  if (!folderName) {
    // User canceled the input
    return null;
  }

  const workspaceUri = workspaceFolders[0].uri;
  const workspaceFsPath = vscode.Uri.joinPath(workspaceUri, folderName).fsPath;
  return workspaceFsPath;
}

// Define the command to activate the extension
function activate(context) {
  // Register the command
  let disposable = vscode.commands.registerCommand(
    "extension.replaceStringAndImport",
    async () => {
      // Get the user-provided folder name and generate the relative path
      const projectDir = await getReactProjectDirFromUser();
      if (!projectDir) {
        // User canceled the input or no workspace is opened
        return;
      }

      const searchFor = await vscode.window.showInputBox({
        prompt: "Enter the search string to replace",
        placeHolder: 'e.g., ="#3762DD"',
      });

      if (!searchFor) {
        // User canceled or did not provide the search string
        return;
      }

      const replaceWith = await vscode.window.showInputBox({
        prompt: "Enter the replace string",
        placeHolder: "e.g., ={colorNameMapper.ROYAL_BLUE}",
      });

      if (!replaceWith) {
        // User canceled or did not provide the replace string
        return;
      }

      const importStatement = await vscode.window.showInputBox({
        prompt: "Enter the import statement",
        placeHolder:
          'e.g., import { colorNameMapper } from "~/constants/colorConstants"',
      });

      if (!importStatement) {
        // User canceled or did not provide the import statement
        return;
      }

      async function replaceStringAndImport(uri) {
        try {
          const document = await vscode.workspace.openTextDocument(uri);
          const text = document.getText();

          if (text.includes(searchFor)) {
            // Replace the string if it exists in the file
            const updatedText = text.replace(
              new RegExp(escapeRegExp(searchFor), "g"),
              replaceWith
            );

            // Remove quotes around the variable in the file
            const regex = new RegExp(`(["'])${replaceWith}\\1`, "g");
            const finalText = updatedText.replace(regex, replaceWith);

            if (!text.includes(importStatement)) {
              // Add the import statement only if it doesn't exist in the file
              const updatedFileText = importStatement + "\n" + finalText;

              await vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(updatedFileText, "utf8")
              );
              vscode.window.showInformationMessage(
                `Replaced '${searchFor}' with '${replaceWith}' and added import statement in ${uri.fsPath}`
              );
            } else {
              await vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(finalText, "utf8")
              );
              vscode.window.showInformationMessage(
                `Replaced '${searchFor}' with '${replaceWith}' in ${uri.fsPath}`
              );
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Error reading/writing file: ${error.message}`
          );
        }
      }

      function escapeRegExp(string) {
        return string.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&"); // Escape special characters
      }

      async function traverseDirectory(uri) {
        try {
          const entries = await vscode.workspace.fs.readDirectory(uri);
          for (const entry of entries) {
            const [name, type] = entry;
            const entryUri = vscode.Uri.joinPath(uri, name);

            if (type === vscode.FileType.File && name.endsWith(".tsx")) {
              // If it's a TSX file, replace the string and add the import
              await replaceStringAndImport(entryUri);
            } else if (type === vscode.FileType.Directory) {
              // If it's a directory, traverse it recursively
              await traverseDirectory(entryUri);
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Error reading directory: ${error.message}`
          );
        }
      }

      if (projectDir) {
        // Convert the user input to a URI and start traversing the directory
        const rootUri = vscode.Uri.file(projectDir);
        traverseDirectory(rootUri);
      }
    }
  );

  context.subscriptions.push(disposable);
}

module.exports = {
  activate,
};
