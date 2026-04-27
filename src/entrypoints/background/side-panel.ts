import type { browser } from "#imports"
import type { onMessage } from "@/utils/message"

interface SidePanelApi {
  close?: (options: { windowId: number }) => Promise<void> | void
  open: (options: { windowId: number }) => Promise<void> | void
  onClosed?: SidePanelEvent<SidePanelStateInfo>
  onOpened?: SidePanelEvent<SidePanelStateInfo>
}

interface SidePanelEvent<TInfo> {
  addListener: (callback: (info: TInfo) => void) => void
}

interface SidePanelStateInfo {
  windowId?: number
}

interface ToggleSidePanelMessage {
  sender?: {
    tab?: {
      id?: number
      windowId?: number
    }
  }
}

type ToggleSidePanelResult
  = | { ok: true, action: "opened" | "closed" }
    | { ok: false, reason: "missing-window" | "unsupported" | "toggle-failed" }

interface SidePanelLogger {
  error: (...args: any[]) => void
  warn: (...args: any[]) => void
}

export function createSidePanelWindowState() {
  const activeWindowIds = new Set<number>()

  return {
    isOpen(windowId: number) {
      return activeWindowIds.has(windowId)
    },
    markClosed(info: SidePanelStateInfo) {
      if (typeof info.windowId === "number") {
        activeWindowIds.delete(info.windowId)
      }
    },
    markOpened(info: SidePanelStateInfo) {
      if (typeof info.windowId === "number") {
        activeWindowIds.add(info.windowId)
      }
    },
  }
}

export function getSidePanelApi(extensionBrowser: typeof browser): SidePanelApi | null {
  const browserWithSidePanel = extensionBrowser as typeof extensionBrowser & { sidePanel?: Partial<SidePanelApi> }
  if (typeof browserWithSidePanel.sidePanel?.open === "function") {
    return browserWithSidePanel.sidePanel as SidePanelApi
  }

  const globalWithChrome = globalThis as typeof globalThis & {
    chrome?: { sidePanel?: Partial<SidePanelApi> }
  }
  if (typeof globalWithChrome.chrome?.sidePanel?.open === "function") {
    return globalWithChrome.chrome.sidePanel as SidePanelApi
  }

  return null
}

export function createToggleSidePanelHandler({
  getApi,
  logger,
  windowState = createSidePanelWindowState(),
}: {
  getApi: () => SidePanelApi | null
  logger: SidePanelLogger
  windowState?: ReturnType<typeof createSidePanelWindowState>
}) {
  return (message: ToggleSidePanelMessage): Promise<ToggleSidePanelResult> => {
    const windowId = message.sender?.tab?.windowId
    if (typeof windowId !== "number") {
      logger.warn("Cannot toggle side panel without a sender window", message)
      return Promise.resolve({ ok: false, reason: "missing-window" } as const)
    }

    const sidePanel = getApi()
    if (!sidePanel) {
      logger.warn("Side panel API is unavailable in this browser")
      return Promise.resolve({ ok: false, reason: "unsupported" } as const)
    }

    if (windowState.isOpen(windowId)) {
      if (typeof sidePanel.close !== "function") {
        logger.warn("Side panel close API is unavailable in this browser")
        return Promise.resolve({ ok: false, reason: "unsupported" } as const)
      }

      try {
        const closeResult = sidePanel.close({ windowId })
        return Promise.resolve(closeResult)
          .then(() => {
            windowState.markClosed({ windowId })
            return { ok: true, action: "closed" } as const
          })
          .catch((error) => {
            windowState.markClosed({ windowId })
            logger.error("Failed to close side panel", error)
            return { ok: false, reason: "toggle-failed" } as const
          })
      }
      catch (error) {
        windowState.markClosed({ windowId })
        logger.error("Failed to close side panel", error)
        return Promise.resolve({ ok: false, reason: "toggle-failed" } as const)
      }
    }

    try {
      // Chrome requires sidePanel.open() to run directly in the user-gesture
      // task. Do not await other async APIs before this call.
      const openResult = sidePanel.open({ windowId })
      return Promise.resolve(openResult)
        .then(() => {
          windowState.markOpened({ windowId })
          return { ok: true, action: "opened" } as const
        })
        .catch((error) => {
          logger.error("Failed to open side panel", error)
          return { ok: false, reason: "toggle-failed" } as const
        })
    }
    catch (error) {
      logger.error("Failed to open side panel", error)
      return Promise.resolve({ ok: false, reason: "toggle-failed" } as const)
    }
  }
}

export function setupSidePanelMessageHandler({
  extensionBrowser,
  logger,
  registerMessageHandler,
}: {
  extensionBrowser: typeof browser
  logger: SidePanelLogger
  registerMessageHandler: typeof onMessage
}) {
  const windowState = createSidePanelWindowState()
  const sidePanel = getSidePanelApi(extensionBrowser)
  sidePanel?.onOpened?.addListener((info) => {
    windowState.markOpened(info)
  })
  sidePanel?.onClosed?.addListener((info) => {
    windowState.markClosed(info)
  })

  registerMessageHandler("toggleSidePanel", createToggleSidePanelHandler({
    getApi: () => getSidePanelApi(extensionBrowser),
    logger,
    windowState,
  }))
}
