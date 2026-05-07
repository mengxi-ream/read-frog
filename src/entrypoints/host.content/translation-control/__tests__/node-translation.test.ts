// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import { registerNodeTranslationTriggers } from "../node-translation"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn(),
  removeOrShowNodeTranslation: vi.fn(),
  sendMessage: vi.fn(),
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mocks.getLocalConfig,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeOrShowNodeTranslation: mocks.removeOrShowNodeTranslation,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mocks.sendMessage,
}))

function createConfig(): Config {
  return {
    translate: {
      node: {
        enabled: true,
        hotkey: "backtick",
      },
    },
  } as Config
}

function dispatchKeyboardEvent(type: "keydown" | "keyup", key: string) {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }))
}

function dispatchMouseEvent(type: "mousemove" | "mouseover", init: MouseEventInit) {
  document.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }))
}

async function triggerBacktickNodeTranslation() {
  dispatchMouseEvent("mousemove", { clientX: 15, clientY: 25 })
  dispatchKeyboardEvent("keydown", "`")
  await Promise.resolve()
  dispatchKeyboardEvent("keyup", "`")
}

describe("registerNodeTranslationTriggers", () => {
  let teardown: (() => void) | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
    vi.clearAllMocks()
  })

  it("requests current iframe injection after a successful top-frame node translation", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslation.mockResolvedValue(true)
    mocks.sendMessage.mockResolvedValue(undefined)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()

    await vi.waitFor(() => {
      expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalledWith(
        { x: 15, y: 25 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ enabled: true }),
          }),
        }),
      )
      expect(mocks.sendMessage).toHaveBeenCalledWith(
        "injectCurrentIframesAfterTopFrameNodeTranslation",
        undefined,
      )
    })
  })

  it("does not request iframe injection when node translation finds no translatable node", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslation.mockResolvedValue(false)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()

    await vi.waitFor(() => {
      expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalled()
    })
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it("requests current iframe injection only once for repeated successful node translations", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslation.mockResolvedValue(true)
    mocks.sendMessage.mockResolvedValue(undefined)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()
    await vi.waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    })

    await triggerBacktickNodeTranslation()
    await vi.waitFor(() => {
      expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalledTimes(2)
    })
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
  })
})
