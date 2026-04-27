import { describe, expect, it, vi } from "vitest"
import { createSplitTranslatorCommandHandler, setupSplitTranslatorCommandHandler, SPLIT_TRANSLATOR_COMMAND } from "../split-translator-command"

function createLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
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

  it("routes the command to side-panel toggle with extension user-action source", async () => {
    const toggleSidePanel = vi.fn().mockResolvedValue({ ok: true, action: "opened" })
    const logger = createLogger()
    const handler = createSplitTranslatorCommandHandler({
      currentWindowId: -2,
      logger,
      toggleSidePanel,
    })

    handler(SPLIT_TRANSLATOR_COMMAND)

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

  it("registers a browser command listener", () => {
    const addListener = vi.fn()
    const toggleSidePanel = vi.fn()
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
  })
})
