import { afterEach, describe, expect, it, vi } from "vitest"
import { createSidePanelWindowState, createToggleSidePanelHandler, getSidePanelApi, setupSidePanelMessageHandler } from "../side-panel"

function createLogger() {
  return {
    error: vi.fn(),
    warn: vi.fn(),
  }
}

const senderWindowMessage = {
  sender: {
    tab: {
      id: 123,
      windowId: 456,
    },
  },
}

function chromiumSidePanel<TApi>(api: TApi) {
  return {
    kind: "chromium-side-panel" as const,
    api,
  }
}

function firefoxSidebarAction<TApi>(api: TApi) {
  return {
    kind: "firefox-sidebar-action" as const,
    api,
  }
}

describe("background side panel", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens the global side panel synchronously so Chrome keeps the user gesture", async () => {
    const logger = createLogger()
    const calls: string[] = []
    const sidePanel = {
      setOptions: vi.fn(() => {
        calls.push("setOptions")
      }),
      open: vi.fn((_options: { windowId: number }) => {
        calls.push("open")
        return Promise.resolve()
      }),
    }

    const handler = createToggleSidePanelHandler({
      getApi: () => chromiumSidePanel(sidePanel),
      logger,
    })

    const result = handler(senderWindowMessage)

    expect(sidePanel.open).toHaveBeenCalledWith({ windowId: 456 })
    expect(sidePanel.open.mock.calls[0]?.[0]).not.toHaveProperty("tabId")
    expect(sidePanel.setOptions).not.toHaveBeenCalled()
    expect(calls).toEqual(["open"])
    await expect(result).resolves.toEqual({ ok: true, action: "opened" })
  })

  it("closes the global side panel when the sender window is already open", async () => {
    const logger = createLogger()
    const windowState = createSidePanelWindowState()
    const calls: string[] = []
    const sidePanel = {
      close: vi.fn((_options: { windowId: number }) => {
        calls.push("close")
        return Promise.resolve()
      }),
      open: vi.fn((_options: { windowId: number }) => {
        calls.push("open")
        return Promise.resolve()
      }),
    }
    windowState.markOpened({ windowId: 456 })

    const handler = createToggleSidePanelHandler({
      getApi: () => chromiumSidePanel(sidePanel),
      logger,
      windowState,
    })

    await expect(handler(senderWindowMessage)).resolves.toEqual({ ok: true, action: "closed" })
    expect(sidePanel.close).toHaveBeenCalledWith({ windowId: 456 })
    expect(sidePanel.close.mock.calls[0]?.[0]).not.toHaveProperty("tabId")
    expect(sidePanel.open).not.toHaveBeenCalled()
    expect(calls).toEqual(["close"])
    expect(windowState.isOpen(456)).toBe(false)
  })

  it("tracks browser side panel open and close events for toggle state", async () => {
    const logger = createLogger()
    const onOpenedListeners: Array<(info: { windowId?: number }) => void> = []
    const onClosedListeners: Array<(info: { windowId?: number }) => void> = []
    const registeredMessageHandlers = new Map<string, (message: typeof senderWindowMessage) => Promise<{ ok: true } | { ok: false, reason: string }>>()
    const sidePanel = {
      close: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(undefined),
      onClosed: {
        addListener: vi.fn((listener) => {
          onClosedListeners.push(listener)
        }),
      },
      onOpened: {
        addListener: vi.fn((listener) => {
          onOpenedListeners.push(listener)
        }),
      },
    }

    setupSidePanelMessageHandler({
      extensionBrowser: { sidePanel } as any,
      logger,
      registerMessageHandler: ((type: string, handler: (message: typeof senderWindowMessage) => Promise<{ ok: true } | { ok: false, reason: string }>) => {
        registeredMessageHandlers.set(type, handler)
      }) as any,
    })

    onOpenedListeners[0]?.({ windowId: 456 })

    const handler = registeredMessageHandlers.get("toggleSidePanel")
    if (!handler) {
      throw new Error("toggleSidePanel handler was not registered")
    }

    await expect(handler(senderWindowMessage)).resolves.toEqual({ ok: true, action: "closed" })
    expect(sidePanel.close).toHaveBeenCalledWith({ windowId: 456 })

    onClosedListeners[0]?.({ windowId: 456 })
    await expect(handler(senderWindowMessage)).resolves.toEqual({ ok: true, action: "opened" })
    expect(sidePanel.open).toHaveBeenCalledWith({ windowId: 456 })
  })

  it("returns an unsupported result when closing is unavailable", async () => {
    const logger = createLogger()
    const windowState = createSidePanelWindowState()
    const sidePanel = {
      open: vi.fn(),
    }
    windowState.markOpened({ windowId: 456 })

    const handler = createToggleSidePanelHandler({
      getApi: () => chromiumSidePanel(sidePanel),
      logger,
      windowState,
    })

    await expect(handler(senderWindowMessage)).resolves.toEqual({ ok: false, reason: "unsupported" })
    expect(logger.warn).toHaveBeenCalledWith("Side panel close API is unavailable in this browser")
    expect(sidePanel.open).not.toHaveBeenCalled()
  })

  it("clears stale open state when Chrome rejects close", async () => {
    const logger = createLogger()
    const windowState = createSidePanelWindowState()
    const error = new Error("No active global side panel")
    const sidePanel = {
      close: vi.fn().mockRejectedValue(error),
      open: vi.fn().mockResolvedValue(undefined),
    }
    windowState.markOpened({ windowId: 456 })

    const handler = createToggleSidePanelHandler({
      getApi: () => chromiumSidePanel(sidePanel),
      logger,
      windowState,
    })

    await expect(handler(senderWindowMessage)).resolves.toEqual({ ok: false, reason: "toggle-failed" })
    expect(logger.error).toHaveBeenCalledWith("Failed to close side panel", error)
    expect(windowState.isOpen(456)).toBe(false)

    await expect(handler(senderWindowMessage)).resolves.toEqual({ ok: true, action: "opened" })
    expect(sidePanel.open).toHaveBeenCalledWith({ windowId: 456 })
  })

  it("returns an unsupported result when the side panel API is unavailable", async () => {
    const logger = createLogger()
    const handler = createToggleSidePanelHandler({
      getApi: () => null,
      logger,
    })

    await expect(handler(senderWindowMessage)).resolves.toEqual({ ok: false, reason: "unsupported" })
    expect(logger.warn).toHaveBeenCalledWith("Side panel API is unavailable in this browser")
  })

  it("does not open the Firefox sidebar from a content-script message", async () => {
    const logger = createLogger()
    const sidebarAction = {
      open: vi.fn(),
    }
    const handler = createToggleSidePanelHandler({
      getApi: () => firefoxSidebarAction(sidebarAction),
      logger,
    })

    await expect(handler(senderWindowMessage)).resolves.toEqual({
      ok: false,
      reason: "requires-extension-user-action",
    })
    expect(sidebarAction.open).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith("Firefox sidebar requires an extension user action")
  })

  it("opens the Firefox sidebar when called from an extension user action", async () => {
    const logger = createLogger()
    const sidebarAction = {
      open: vi.fn().mockResolvedValue(undefined),
    }
    const handler = createToggleSidePanelHandler({
      getApi: () => firefoxSidebarAction(sidebarAction),
      logger,
    })

    const result = handler({ data: { source: "extension-user-action" } })

    expect(sidebarAction.open).toHaveBeenCalled()
    await expect(result).resolves.toEqual({ ok: true, action: "opened" })
  })

  it("returns a missing-window result when the sender window id is unavailable", async () => {
    const logger = createLogger()
    const handler = createToggleSidePanelHandler({
      getApi: () => chromiumSidePanel({ open: vi.fn() }),
      logger,
    })

    await expect(handler({ sender: { tab: { id: 123 } } })).resolves.toEqual({ ok: false, reason: "missing-window" })
    expect(logger.warn).toHaveBeenCalledWith(
      "Cannot toggle side panel without a sender window",
      { sender: { tab: { id: 123 } } },
    )
  })

  it("returns a toggle-failed result when Chrome rejects the open request", async () => {
    const logger = createLogger()
    const error = new Error("sidePanel.open() may only be called in response to a user gesture")
    const handler = createToggleSidePanelHandler({
      getApi: () => chromiumSidePanel({
        open: vi.fn().mockRejectedValue(error),
      }),
      logger,
    })

    await expect(handler(senderWindowMessage)).resolves.toEqual({ ok: false, reason: "toggle-failed" })
    expect(logger.error).toHaveBeenCalledWith("Failed to open side panel", error)
  })

  it("finds the Chrome sidePanel API when the WXT browser wrapper does not expose it", () => {
    const sidePanel = {
      open: vi.fn(),
    }
    vi.stubGlobal("chrome", {
      sidePanel,
    })

    expect(getSidePanelApi({} as any)).toEqual({
      kind: "chromium-side-panel",
      api: sidePanel,
    })
  })

  it("finds the Firefox sidebarAction API from the WXT browser wrapper", () => {
    const sidebarAction = {
      open: vi.fn(),
    }

    expect(getSidePanelApi({ sidebarAction } as any)).toEqual({
      kind: "firefox-sidebar-action",
      api: sidebarAction,
    })
  })
})
