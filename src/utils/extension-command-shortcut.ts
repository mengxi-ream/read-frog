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

/**
 * Returns the trimmed shortcut for a command and lets getAll() errors bubble up.
 */
export async function getExtensionCommandShortcut(
  commandName: string,
  extensionBrowser: ExtensionCommandsBrowserLike = browser,
): Promise<string> {
  const commands = await extensionBrowser.commands.getAll()

  return commands.find(command => command.name === commandName)?.shortcut?.trim() ?? ""
}
