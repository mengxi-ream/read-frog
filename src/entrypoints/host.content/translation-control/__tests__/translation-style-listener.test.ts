// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import type { TranslationNodeStyleConfig } from "@/types/config/translate"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { resolveLiveTranslationNodeStyle } from "@/utils/host/translate/ui/live-translation-style"

const { mockGetLocalConfig, mockHandleTranslationStyleChange, mockUnwatch, mockWatch } = vi.hoisted(
  () => ({
    mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
    mockHandleTranslationStyleChange: vi.fn<(...args: any[]) => any>(),
    mockUnwatch: vi.fn<(...args: any[]) => any>(),
    mockWatch: vi.fn<(...args: any[]) => any>(),
  }),
)

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock("@/utils/atoms/storage-adapter", () => ({
  storageAdapter: {
    watch: mockWatch,
  },
}))

vi.mock("../handle-config-change", () => ({
  handleTranslationStyleChange: mockHandleTranslationStyleChange,
}))

import { registerTranslationStyleListener } from "../translation-style-listener"

function createStyle(preset: "dashedLine" | "border"): TranslationNodeStyleConfig {
  return {
    preset,
    isCustom: false,
    customCSS: null,
  }
}

function createConfig(style: TranslationNodeStyleConfig): Config {
  return {
    translate: {
      translationNodeStyle: style,
    },
  } as Config
}

describe("registerTranslationStyleListener", () => {
  let notifyConfigChange: (config: Config) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLocalConfig.mockResolvedValue(null)
    mockHandleTranslationStyleChange.mockResolvedValue(undefined)
    mockWatch.mockImplementation((_key: string, callback: (config: Config) => void) => {
      notifyConfigChange = callback
      return mockUnwatch
    })
  })

  it("reacts only to translationNodeStyle changes and cleans up the live style", async () => {
    const initialStyle = createStyle("dashedLine")
    const fallbackStyle = createStyle("border")
    const cleanup = registerTranslationStyleListener(initialStyle)

    expect(mockWatch).toHaveBeenCalledWith(CONFIG_STORAGE_KEY, expect.any(Function))
    expect(resolveLiveTranslationNodeStyle(fallbackStyle)).toBe(initialStyle)

    notifyConfigChange(createConfig(createStyle("dashedLine")))
    expect(mockHandleTranslationStyleChange).not.toHaveBeenCalled()

    const nextStyle = createStyle("border")
    notifyConfigChange(createConfig(nextStyle))
    await vi.waitFor(() => expect(mockHandleTranslationStyleChange).toHaveBeenCalledOnce())
    expect(mockHandleTranslationStyleChange).toHaveBeenCalledWith(nextStyle)
    expect(resolveLiveTranslationNodeStyle(fallbackStyle)).toBe(nextStyle)

    cleanup()
    expect(mockUnwatch).toHaveBeenCalledOnce()
    expect(resolveLiveTranslationNodeStyle(fallbackStyle)).toBe(fallbackStyle)
  })

  it("serializes rapid style changes", async () => {
    let releaseFirst: (() => void) | undefined
    mockHandleTranslationStyleChange
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve
          }),
      )
      .mockResolvedValueOnce(undefined)

    const cleanup = registerTranslationStyleListener(createStyle("dashedLine"))
    notifyConfigChange(createConfig(createStyle("border")))
    notifyConfigChange(createConfig(createStyle("dashedLine")))

    await vi.waitFor(() => expect(mockHandleTranslationStyleChange).toHaveBeenCalledTimes(1))
    releaseFirst?.()
    await vi.waitFor(() => expect(mockHandleTranslationStyleChange).toHaveBeenCalledTimes(2))

    cleanup()
  })

  it("reconciles a missed style change when a frozen tab becomes visible", async () => {
    const initialStyle = createStyle("dashedLine")
    const nextStyle = createStyle("border")
    mockGetLocalConfig.mockResolvedValue(createConfig(nextStyle))
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })

    const cleanup = registerTranslationStyleListener(initialStyle)
    document.dispatchEvent(new Event("visibilitychange"))

    await vi.waitFor(() => expect(mockHandleTranslationStyleChange).toHaveBeenCalledWith(nextStyle))
    expect(resolveLiveTranslationNodeStyle(initialStyle)).toBe(nextStyle)

    cleanup()
    document.dispatchEvent(new Event("visibilitychange"))
    expect(mockGetLocalConfig).toHaveBeenCalledOnce()
  })
})
