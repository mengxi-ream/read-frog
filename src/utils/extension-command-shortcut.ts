import { browser } from "#imports"

interface ExtensionCommandLike {
  name?: string
  shortcut?: string
}

interface ExtensionCommandsBrowserLike {
  commands: {
    getAll: () => Promise<ExtensionCommandLike[]>
  }
}

export async function getExtensionCommandShortcut(
  commandName: string,
  extensionBrowser: ExtensionCommandsBrowserLike = browser,
): Promise<string> {
  const commands = await extensionBrowser.commands.getAll()

  return commands.find(command => command.name === commandName)?.shortcut?.trim() ?? ""
}
