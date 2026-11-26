import type { browser } from "#imports"
import type { onMessage } from "@/utils/message"
import { createLogger } from "@/utils/logging/logger"

const log = createLogger("background/side-panel")

interface ChromiumSidePanelApi {
  close?: (options: { windowId: number }) => Promise<void> | void
  open: (options: { windowId: number }) => Promise<void> | void
  onClosed?: SidePanelEvent<SidePanelStateInfo>
  onOpened?: SidePanelEvent<SidePanelStateInfo>
}

interface FirefoxSidebarActionApi {
  close?: () => Promise<void> | void
  open?: () => Promise<void> | void
  toggle?: () => Promise<void> | void
}

type BrowserSidePanelApi =
  | { kind: "chromium-side-panel"; api: ChromiumSidePanelApi }
  | { kind: "firefox-sidebar-action"; api: FirefoxSidebarActionApi }

interface SidePanelEvent<TInfo> {
  addListener: (callback: (info: TInfo) => void) => void
}

interface SidePanelStateInfo {
  windowId?: number
}

interface ToggleSidePanelMessage {
  data?: {
    source?: "content-script" | "extension-user-action"
  }
  sender?: {
    tab?: {
      id?: number
      windowId?: number
    }
  }
}

type ToggleSidePanelResult =
  | { ok: true; action: "opened" | "closed" }
  | {
      ok: false
      reason: "missing-window" | "unsupported" | "toggle-failed" | "requires-extension-user-action"
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

function getToggleSource(message: ToggleSidePanelMessage) {
  return message.data?.source ?? "content-script"
}

function toChromiumSidePanelApi(
  api: Partial<ChromiumSidePanelApi> | undefined,
): BrowserSidePanelApi | null {
  if (typeof api?.open !== "function") {
    return null
  }

  return {
    kind: "chromium-side-panel",
    api: api as ChromiumSidePanelApi,
  }
}

function toFirefoxSidebarActionApi(
  api: Partial<FirefoxSidebarActionApi> | undefined,
): BrowserSidePanelApi | null {
  if (typeof api?.open !== "function" && typeof api?.toggle !== "function") {
    return null
  }

  return {
    kind: "firefox-sidebar-action",
    api,
  }
}

export function getSidePanelApi(extensionBrowser: typeof browser): BrowserSidePanelApi | null {
  const browserWithSidePanel = extensionBrowser
  if (typeof browserWithSidePanel.sidePanel?.open === "function") {
    return toChromiumSidePanelApi(browserWithSidePanel.sidePanel)
  }

  const globalWithChrome = globalThis as typeof globalThis & {
    chrome?: { sidePanel?: Partial<ChromiumSidePanelApi> }
  }
  if (typeof globalWithChrome.chrome?.sidePanel?.open === "function") {
    return toChromiumSidePanelApi(globalWithChrome.chrome.sidePanel)
  }

  const browserWithSidebarAction = extensionBrowser as typeof extensionBrowser & {
    sidebarAction?: Partial<FirefoxSidebarActionApi>
  }
  const sidebarAction = toFirefoxSidebarActionApi(browserWithSidebarAction.sidebarAction)
  if (sidebarAction) {
    return sidebarAction
  }

  const globalWithBrowser = globalThis as typeof globalThis & {
    browser?: { sidebarAction?: Partial<FirefoxSidebarActionApi> }
  }
  const globalSidebarAction = toFirefoxSidebarActionApi(globalWithBrowser.browser?.sidebarAction)
  if (globalSidebarAction) {
    return globalSidebarAction
  }

  return null
}

function toggleFirefoxSidebarAction({
  api,
  source,
}: {
  api: FirefoxSidebarActionApi
  source: ReturnType<typeof getToggleSource>
}): Promise<ToggleSidePanelResult> {
  if (source !== "extension-user-action") {
    log.warn("Firefox sidebar requires an extension user action")
    return Promise.resolve({ ok: false, reason: "requires-extension-user-action" } as const)
  }

  const openSidebar =
    typeof api.open === "function"
      ? () => api.open?.()
      : typeof api.toggle === "function"
        ? () => api.toggle?.()
        : null
  if (!openSidebar) {
    log.warn("Firefox sidebar open API is unavailable in this browser")
    return Promise.resolve({ ok: false, reason: "unsupported" } as const)
  }

  try {
    const openResult = openSidebar()
    return Promise.resolve(openResult)
      .then(() => ({ ok: true, action: "opened" }) as const)
      .catch((error) => {
        log.error("Failed to open Firefox sidebar", { error })
        return { ok: false, reason: "toggle-failed" } as const
      })
  } catch (error) {
    log.error("Failed to open Firefox sidebar", { error })
    return Promise.resolve({ ok: false, reason: "toggle-failed" } as const)
  }
}

export function createToggleSidePanelHandler({
  getApi,
  windowState = createSidePanelWindowState(),
}: {
  getApi: () => BrowserSidePanelApi | null
  windowState?: ReturnType<typeof createSidePanelWindowState>
}) {
  return (message: ToggleSidePanelMessage): Promise<ToggleSidePanelResult> => {
    const browserSidePanel = getApi()
    if (!browserSidePanel) {
      log.warn("Side panel API is unavailable in this browser")
      return Promise.resolve({ ok: false, reason: "unsupported" } as const)
    }

    if (browserSidePanel.kind === "firefox-sidebar-action") {
      return toggleFirefoxSidebarAction({
        api: browserSidePanel.api,
        source: getToggleSource(message),
      })
    }

    const windowId = message.sender?.tab?.windowId
    if (typeof windowId !== "number") {
      log.warn("Cannot toggle side panel without a sender window", { sender: message.sender })
      return Promise.resolve({ ok: false, reason: "missing-window" } as const)
    }

    const sidePanel = browserSidePanel.api

    if (windowState.isOpen(windowId)) {
      if (typeof sidePanel.close !== "function") {
        log.warn("Side panel close API is unavailable in this browser")
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
            log.error("Failed to close side panel", { error })
            return { ok: false, reason: "toggle-failed" } as const
          })
      } catch (error) {
        windowState.markClosed({ windowId })
        log.error("Failed to close side panel", { error })
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
          log.error("Failed to open side panel", { error })
          return { ok: false, reason: "toggle-failed" } as const
        })
    } catch (error) {
      log.error("Failed to open side panel", { error })
      return Promise.resolve({ ok: false, reason: "toggle-failed" } as const)
    }
  }
}

export function setupSidePanelMessageHandler({
  extensionBrowser,
  registerMessageHandler,
}: {
  extensionBrowser: typeof browser
  registerMessageHandler: typeof onMessage
}) {
  const windowState = createSidePanelWindowState()
  const sidePanel = getSidePanelApi(extensionBrowser)
  if (sidePanel?.kind !== "chromium-side-panel") {
    registerMessageHandler(
      "toggleSidePanel",
      createToggleSidePanelHandler({
        getApi: () => getSidePanelApi(extensionBrowser),
        windowState,
      }),
    )
    return
  }

  sidePanel.api.onOpened?.addListener((info) => {
    windowState.markOpened(info)
  })
  sidePanel.api.onClosed?.addListener((info) => {
    windowState.markClosed(info)
  })

  registerMessageHandler(
    "toggleSidePanel",
    createToggleSidePanelHandler({
      getApi: () => getSidePanelApi(extensionBrowser),
      windowState,
    }),
  )
}
