// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  claimPageTranslationRequestFailure,
  reportPageTranslationRequestFailed,
} from "@/utils/host/translate/translation-session"
import { registerNodeTranslationTriggers } from "../node-translation"

const mocks = vi.hoisted(() => ({
  block: document.createElement("p"),
  getLocalConfig: vi.fn<(...args: any[]) => any>(),
  removeOrShowNodeTranslation: vi.fn<(...args: any[]) => any>(),
  sendMessage: vi.fn<(...args: any[]) => any>(),
  promptForBuiltInAiRefusal: vi.fn<(...args: any[]) => Promise<boolean>>(),
}))

vi.mock("@/utils/content-runtime/built-in-ai-prompt", () => ({
  promptForBuiltInAiRefusal: mocks.promptForBuiltInAiRefusal,
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mocks.getLocalConfig,
}))

vi.mock("@/utils/host/dom/find", () => ({
  findNearestAncestorBlockNodeAt: () => mocks.block,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeOrShowNodeTranslation: mocks.removeOrShowNodeTranslation,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mocks.sendMessage,
}))

function createConfig(): Config {
  return {
    pageTranslation: {
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
        mocks.block,
        expect.objectContaining({
          pageTranslation: expect.objectContaining({
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

describe("hover translation when Built-in AI refuses", () => {
  let teardown: (() => void) | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
    vi.clearAllMocks()
  })

  /** A paragraph's request the server refused; the paragraph shows it inline and reports it. */
  function spentPoolError() {
    return Object.assign(new Error("Built-in AI quota used up"), {
      code: "HOSTED_AI_QUOTA_EXHAUSTED",
    })
  }

  function refuseParagraphs(error: Error, options: { claimedBySession?: boolean } = {}) {
    mocks.removeOrShowNodeTranslation.mockImplementationOnce(async () => {
      if (options.claimedBySession) {
        claimPageTranslationRequestFailure(error)
      }
      reportPageTranslationRequestFailed(error)
      reportPageTranslationRequestFailed(spentPoolError())
      return true
    })
  }

  it("asks to upgrade once for the node, with page translation's provider and feature", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.sendMessage.mockResolvedValue(undefined)
    mocks.promptForBuiltInAiRefusal.mockResolvedValue(true)
    const refusal = spentPoolError()
    refuseParagraphs(refusal)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()

    await vi.waitFor(() => expect(mocks.promptForBuiltInAiRefusal).toHaveBeenCalledOnce())
    expect(mocks.promptForBuiltInAiRefusal).toHaveBeenCalledWith(refusal, {
      feature: "pageTranslation",
      analyticsFeature: "page_translation",
      trigger: "user",
      retry: expect.any(Function),
    })
  })

  it("translates the node again after a switch to machine translation", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.sendMessage.mockResolvedValue(undefined)
    mocks.promptForBuiltInAiRefusal.mockResolvedValue(true)
    refuseParagraphs(spentPoolError())
    teardown = registerNodeTranslationTriggers()
    await triggerBacktickNodeTranslation()
    await vi.waitFor(() => expect(mocks.promptForBuiltInAiRefusal).toHaveBeenCalledOnce())

    mocks.removeOrShowNodeTranslation.mockResolvedValue(true)
    mocks.promptForBuiltInAiRefusal.mock.calls[0]![1].retry()

    // Off with the inline errors, then on again with the new provider.
    await vi.waitFor(() => expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalledTimes(3))
    expect(
      mocks.removeOrShowNodeTranslation.mock.calls.every(([block]) => block === mocks.block),
    ).toBe(true)
    expect(mocks.promptForBuiltInAiRefusal).toHaveBeenCalledOnce()
  })

  it("stays quiet about a refusal the running page translation already asked about", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.sendMessage.mockResolvedValue(undefined)
    const refusal = spentPoolError()
    refuseParagraphs(refusal, { claimedBySession: true })
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()
    await vi.waitFor(() => expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.promptForBuiltInAiRefusal).not.toHaveBeenCalled()
  })

  it("keeps any other failure to the paragraph's inline error", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.sendMessage.mockResolvedValue(undefined)
    mocks.removeOrShowNodeTranslation.mockImplementationOnce(async () => {
      reportPageTranslationRequestFailed(new Error("Failed to fetch"))
      return true
    })
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()
    await vi.waitFor(() => expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.promptForBuiltInAiRefusal).not.toHaveBeenCalled()
  })
})
