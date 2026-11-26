import { browser, storage } from "#imports"
import { getSelectionToolbarHiddenKey } from "@/utils/constants/storage-keys"
import { createLogger } from "@/utils/logging/logger"
import { onMessage, sendMessage } from "@/utils/message"

const log = createLogger("background/selection-toolbar-hidden")

/**
 * The selection toolbar's "Until I reload this page" hide, kept per tab so it
 * covers the whole page: each iframe runs its own toolbar, which would
 * otherwise still show. The top frame's next navigation, a reload included,
 * clears it. Session storage keeps it across a service worker restart.
 */
export async function isSelectionToolbarHiddenInTab(tabId: number): Promise<boolean> {
  return (await storage.getItem<boolean>(getSelectionToolbarHiddenKey(tabId))) === true
}

function clearSelectionToolbarHidden(tabId: number) {
  void storage.removeItem(getSelectionToolbarHiddenKey(tabId))
}

export function setupSelectionToolbarHiddenUntilReload() {
  onMessage("hideSelectionToolbarUntilReload", async ({ sender }) => {
    const tabId = sender.tab?.id
    if (tabId === undefined) return
    await storage.setItem<boolean>(getSelectionToolbarHiddenKey(tabId), true)
    // Reaches every frame of the tab, the one that asked included.
    void sendMessage("selectionToolbarHiddenUntilReload", undefined, tabId).catch((error) =>
      log.debug("Failed to hide the selection toolbar in the tab's frames", { error }),
    )
  })

  onMessage("isSelectionToolbarHiddenUntilReload", async ({ sender }) => {
    const tabId = sender.tab?.id
    // A page Chrome prerenders in this tab runs its toolbar before it is shown,
    // and it is the next page, not the one the user hid the toolbar on. Its
    // activation commits in the top frame, which clears the flag.
    const prerendering = "documentLifecycle" in sender && sender.documentLifecycle === "prerender"
    return tabId !== undefined && !prerendering && (await isSelectionToolbarHiddenInTab(tabId))
  })

  browser.tabs.onRemoved.addListener(clearSelectionToolbarHidden)
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) clearSelectionToolbarHidden(details.tabId)
  })
}
