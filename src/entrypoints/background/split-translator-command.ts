import type { browser } from "#imports"
import type { createToggleSidePanelHandler } from "./side-panel"

export const SPLIT_TRANSLATOR_COMMAND = "toggle-split-translator"

type ToggleSidePanel = ReturnType<typeof createToggleSidePanelHandler>

interface SplitTranslatorCommandLogger {
  error: (...args: any[]) => void
  warn: (...args: any[]) => void
}

interface CommandTabLike {
  windowId?: number
}

export function createSplitTranslatorCommandHandler({
  currentWindowId,
  logger,
  toggleSidePanel,
}: {
  currentWindowId: number
  logger: SplitTranslatorCommandLogger
  toggleSidePanel: ToggleSidePanel
}) {
  return (command: string, tab?: CommandTabLike) => {
    if (command !== SPLIT_TRANSLATOR_COMMAND) {
      return
    }

    const windowId = typeof tab?.windowId === "number" ? tab.windowId : currentWindowId
    const result = toggleSidePanel({
      data: {
        source: "extension-user-action",
        windowId,
      },
    })

    void result
      .then((toggleResult) => {
        if (!toggleResult.ok) {
          logger.warn("Split translator side panel command did not open the panel", {
            reason: toggleResult.reason,
          })
        }
      })
      .catch((error) => {
        logger.error("Split translator side panel command failed", error)
      })
  }
}

export function setupSplitTranslatorCommandHandler({
  currentWindowId,
  extensionBrowser,
  logger,
  toggleSidePanel,
}: {
  currentWindowId: number
  extensionBrowser: typeof browser
  logger: SplitTranslatorCommandLogger
  toggleSidePanel: ToggleSidePanel
}) {
  extensionBrowser.commands.onCommand.addListener(createSplitTranslatorCommandHandler({
    currentWindowId,
    logger,
    toggleSidePanel,
  }))
}
