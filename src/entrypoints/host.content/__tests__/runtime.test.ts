// @vitest-environment jsdom

import type { ContentScriptContext } from "#imports"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { bootstrapHostContent } from "../runtime"

const {
  messageHandlers,
  managerInstances,
  mockBindTranslationShortcutKey,
  mockClearEffectiveSiteControlUrl,
  mockDetectPageLanguageLightweight,
  mockEnsurePresetStyles,
  mockMountHostToast,
  mockOnMessage,
  mockRegisterNodeTranslationTriggers,
  mockSendMessage,
  mockSetupUrlChangeListener,
} = vi.hoisted(() => ({
  messageHandlers: new Map<string, (msg?: any) => any>(),
  managerInstances: [] as Array<{
    isActive: boolean
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    restart: ReturnType<typeof vi.fn>
    registerPageTranslationTriggers: ReturnType<typeof vi.fn>
  }>,
  mockBindTranslationShortcutKey: vi.fn(),
  mockClearEffectiveSiteControlUrl: vi.fn(),
  mockDetectPageLanguageLightweight: vi.fn(),
  mockEnsurePresetStyles: vi.fn(),
  mockMountHostToast: vi.fn(),
  mockOnMessage: vi.fn(),
  mockRegisterNodeTranslationTriggers: vi.fn(),
  mockSendMessage: vi.fn(),
  mockSetupUrlChangeListener: vi.fn(),
}))

vi.mock("@/utils/content/page-language", () => ({
  detectPageLanguageLightweight: mockDetectPageLanguageLightweight,
}))

vi.mock("@/utils/host/translate/ui/style-injector", () => ({
  ensurePresetStyles: mockEnsurePresetStyles,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/utils/message", () => ({
  onMessage: mockOnMessage,
  sendMessage: mockSendMessage,
}))

vi.mock("@/utils/site-control", () => ({
  clearEffectiveSiteControlUrl: mockClearEffectiveSiteControlUrl,
}))

vi.mock("../listen", () => ({
  setupUrlChangeListener: mockSetupUrlChangeListener,
}))

vi.mock("../mount-host-toast", () => ({
  mountHostToast: mockMountHostToast,
}))

vi.mock("../translation-control/bind-translation-shortcut", () => ({
  bindTranslationShortcutKey: mockBindTranslationShortcutKey,
}))

vi.mock("../translation-control/node-translation", () => ({
  registerNodeTranslationTriggers: mockRegisterNodeTranslationTriggers,
}))

vi.mock("../translation-control/page-translation", () => ({
  PageTranslationManager: class {
    isActive = false
    start = vi.fn(async () => {
      this.isActive = true
    })

    stop = vi.fn(() => {
      this.isActive = false
    })

    restart = vi.fn(async () => {
      this.isActive = true
    })

    registerPageTranslationTriggers = vi.fn(() => vi.fn())

    constructor() {
      managerInstances.push(this)
    }
  },
}))

function createContentScriptContext() {
  const invalidationCallbacks: Array<() => void> = []

  return {
    ctx: {
      onInvalidated: (callback: () => void) => {
        invalidationCallbacks.push(callback)
      },
    } as ContentScriptContext,
    invalidate: () => {
      for (const callback of invalidationCallbacks) {
        callback()
      }
    },
  }
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  await Promise.resolve()
}

describe("bootstrapHostContent URL changes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messageHandlers.clear()
    managerInstances.length = 0

    mockSetupUrlChangeListener.mockReturnValue(vi.fn())
    mockMountHostToast.mockReturnValue(vi.fn())
    mockRegisterNodeTranslationTriggers.mockReturnValue(vi.fn())
    mockBindTranslationShortcutKey.mockResolvedValue(vi.fn())
    mockOnMessage.mockImplementation((name: string, handler: (msg?: any) => any) => {
      messageHandlers.set(name, handler)
      return vi.fn()
    })
    mockDetectPageLanguageLightweight.mockResolvedValue({ detectedCodeOrUnd: "fra" })
    mockSendMessage.mockImplementation((name: string) => {
      if (name === "getEnablePageTranslationFromContentScript")
        return Promise.resolve(false)

      return Promise.resolve(undefined)
    })
  })

  it("refreshes active page translation on same-origin SPA navigation without disabling the session", async () => {
    mockSendMessage.mockImplementation((name: string) => {
      if (name === "getEnablePageTranslationFromContentScript")
        return Promise.resolve(true)

      return Promise.resolve(undefined)
    })

    const { ctx, invalidate } = createContentScriptContext()
    await bootstrapHostContent(ctx, null)
    const manager = managerInstances[0]

    window.dispatchEvent(new CustomEvent("extension:URLChange", {
      detail: {
        from: "https://example.com/articles/1",
        to: "https://example.com/articles/2?ref=nav#comments",
      },
    }))
    await flushAsyncWork()

    expect(manager.start).toHaveBeenCalledTimes(1)
    expect(manager.restart).toHaveBeenCalledTimes(1)
    expect(manager.stop).not.toHaveBeenCalled()
    expect(mockSendMessage).toHaveBeenCalledWith("reportDetectedPageLanguage", {
      url: "https://example.com/articles/2?ref=nav#comments",
      detectedCodeOrUnd: "fra",
    })

    invalidate()
  })

  it("keeps inactive page translation inactive and only asks auto-translation on SPA navigation", async () => {
    const { ctx, invalidate } = createContentScriptContext()
    await bootstrapHostContent(ctx, null)
    const manager = managerInstances[0]

    window.dispatchEvent(new CustomEvent("extension:URLChange", {
      detail: {
        from: "https://example.com/articles/1",
        to: "https://example.com/articles/2",
      },
    }))
    await flushAsyncWork()

    expect(manager.start).not.toHaveBeenCalled()
    expect(manager.restart).not.toHaveBeenCalled()
    expect(manager.stop).not.toHaveBeenCalled()
    expect(mockSendMessage).toHaveBeenCalledWith("reportDetectedPageLanguage", {
      url: "https://example.com/articles/2",
      detectedCodeOrUnd: "fra",
    })

    invalidate()
  })

  it("refreshes and reports detected language when background requests active-tab refresh", async () => {
    const { ctx, invalidate } = createContentScriptContext()
    await bootstrapHostContent(ctx, null)
    await flushAsyncWork()

    mockSendMessage.mockClear()
    mockDetectPageLanguageLightweight.mockClear()
    mockDetectPageLanguageLightweight.mockResolvedValueOnce({ detectedCodeOrUnd: "jpn" })

    const refreshHandler = messageHandlers.get("refreshDetectedPageLanguage")
    if (!refreshHandler) {
      throw new Error("Expected refreshDetectedPageLanguage handler to be registered")
    }

    refreshHandler()
    await flushAsyncWork()

    expect(mockDetectPageLanguageLightweight).toHaveBeenCalledOnce()
    expect(mockSendMessage).toHaveBeenCalledWith("reportDetectedPageLanguage", {
      url: window.location.href,
      detectedCodeOrUnd: "jpn",
    })

    invalidate()
  })
})
