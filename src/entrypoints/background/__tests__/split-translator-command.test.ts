import { describe, expect, it, vi } from "vitest"
import { createSidePanelWindowState, createToggleSidePanelHandler } from "../side-panel"
import { createSplitTranslatorCommandHandler, setupSplitTranslatorCommandHandler, SPLIT_TRANSLATOR_COMMAND } from "../split-translator-command"

function createLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
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

describe("split translator command", () => {
  it("ignores commands that do not belong to split translator", () => {
    const toggleSidePanel = vi.fn()
    const logger = createLogger()
    const handler = createSplitTranslatorCommandHandler({
      currentWindowId: -2,
      logger,
      toggleSidePanel,
    })

    handler("unknown-command")

    expect(toggleSidePanel).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("routes the command to side-panel toggle with the command tab window id", async () => {
    const toggleSidePanel = vi.fn().mockResolvedValue({ ok: true, action: "opened" })
    const logger = createLogger()
    const handler = createSplitTranslatorCommandHandler({
      currentWindowId: -2,
      logger,
      toggleSidePanel,
    })

    handler(SPLIT_TRANSLATOR_COMMAND, { windowId: 456 })

    expect(toggleSidePanel).toHaveBeenCalledWith({
      data: {
        source: "extension-user-action",
        windowId: 456,
      },
    })
    await Promise.resolve()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("falls back to the configured current window id when the command tab has no window id", async () => {
    const toggleSidePanel = vi.fn().mockResolvedValue({ ok: true, action: "opened" })
    const logger = createLogger()
    const handler = createSplitTranslatorCommandHandler({
      currentWindowId: -2,
      logger,
      toggleSidePanel,
    })

    handler(SPLIT_TRANSLATOR_COMMAND, {})

    expect(toggleSidePanel).toHaveBeenCalledWith({
      data: {
        source: "extension-user-action",
        windowId: -2,
      },
    })
    await Promise.resolve()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("logs unsuccessful toggle results", async () => {
    const toggleSidePanel = vi.fn().mockResolvedValue({ ok: false, reason: "unsupported" })
    const logger = createLogger()
    const handler = createSplitTranslatorCommandHandler({
      currentWindowId: -2,
      logger,
      toggleSidePanel,
    })

    handler(SPLIT_TRANSLATOR_COMMAND)
    await Promise.resolve()

    expect(logger.warn).toHaveBeenCalledWith(
      "Split translator side panel command did not open the panel",
      { reason: "unsupported" },
    )
  })

  it("closes the same concrete window when content and command toggles mix", async () => {
    const logger = createLogger()
    const windowState = createSidePanelWindowState()
    const sidePanel = {
      close: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(undefined),
    }
    const toggleSidePanel = createToggleSidePanelHandler({
      getApi: () => chromiumSidePanel(sidePanel),
      logger,
      windowState,
    })
    const handler = createSplitTranslatorCommandHandler({
      currentWindowId: -2,
      logger,
      toggleSidePanel,
    })

    await expect(toggleSidePanel(senderWindowMessage)).resolves.toEqual({ ok: true, action: "opened" })
    handler(SPLIT_TRANSLATOR_COMMAND, { windowId: 456 })
    await Promise.resolve()

    expect(sidePanel.open).toHaveBeenCalledWith({ windowId: 456 })
    expect(sidePanel.close).toHaveBeenCalledWith({ windowId: 456 })
    expect(sidePanel.open).toHaveBeenCalledTimes(1)
    expect(windowState.isOpen(456)).toBe(false)
    expect(windowState.isOpen(-2)).toBe(false)
  })

  it("closes the same concrete window when command and content toggles mix", async () => {
    const logger = createLogger()
    const windowState = createSidePanelWindowState()
    const sidePanel = {
      close: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(undefined),
    }
    const toggleSidePanel = createToggleSidePanelHandler({
      getApi: () => chromiumSidePanel(sidePanel),
      logger,
      windowState,
    })
    const handler = createSplitTranslatorCommandHandler({
      currentWindowId: -2,
      logger,
      toggleSidePanel,
    })

    handler(SPLIT_TRANSLATOR_COMMAND, { windowId: 456 })
    await Promise.resolve()
    await expect(toggleSidePanel(senderWindowMessage)).resolves.toEqual({ ok: true, action: "closed" })

    expect(sidePanel.open).toHaveBeenCalledWith({ windowId: 456 })
    expect(sidePanel.close).toHaveBeenCalledWith({ windowId: 456 })
    expect(sidePanel.open).toHaveBeenCalledTimes(1)
    expect(windowState.isOpen(456)).toBe(false)
    expect(windowState.isOpen(-2)).toBe(false)
  })

  it("registers a browser command listener", () => {
    const addListener = vi.fn()
    const toggleSidePanel = vi.fn().mockResolvedValue({ ok: true, action: "opened" })
    const logger = createLogger()

    setupSplitTranslatorCommandHandler({
      currentWindowId: -2,
      extensionBrowser: {
        commands: {
          onCommand: {
            addListener,
          },
        },
      } as any,
      logger,
      toggleSidePanel,
    })

    expect(addListener).toHaveBeenCalledTimes(1)
    expect(addListener.mock.calls[0]?.[0]).toEqual(expect.any(Function))
    addListener.mock.calls[0]?.[0](SPLIT_TRANSLATOR_COMMAND, { windowId: 456 })
    expect(toggleSidePanel).toHaveBeenCalledWith({
      data: {
        source: "extension-user-action",
        windowId: 456,
      },
    })
  })
})
