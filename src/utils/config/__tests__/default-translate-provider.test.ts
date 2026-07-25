import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  GOOGLE_TRANSLATE_PROVIDER_ID,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "@/utils/constants/providers"

const isGoogleTranslateReachableMock = vi.fn<(...args: any[]) => any>()
const getLocalConfigMock = vi.fn<(...args: any[]) => any>()
const setLocalConfigMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/host/translate/api/google", () => ({
  isGoogleTranslateReachable: isGoogleTranslateReachableMock,
}))

vi.mock("../storage", () => ({
  getLocalConfig: getLocalConfigMock,
  setLocalConfig: setLocalConfigMock,
}))

function translateProviderIdsOf(config: Config) {
  return [
    config.translate.providerId,
    config.selectionToolbar.features.translate.providerId,
    config.inputTranslation.providerId,
    config.videoSubtitles.providerId,
  ]
}

async function promote() {
  const { promoteGoogleTranslateDefaultIfReachable } = await import("../default-translate-provider")
  await promoteGoogleTranslateDefaultIfReachable()
}

describe("promoteGoogleTranslateDefaultIfReachable", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getLocalConfigMock.mockResolvedValue(structuredClone(DEFAULT_CONFIG))
    setLocalConfigMock.mockResolvedValue(undefined)
  })

  it("promotes Google Translate on every translate feature when the probe reaches it", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)

    await promote()

    expect(setLocalConfigMock).toHaveBeenCalledTimes(1)
    const written = setLocalConfigMock.mock.calls[0]?.[0] as Config
    expect(translateProviderIdsOf(written)).toEqual([
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
    ])
  })

  it("leaves the config untouched when Google Translate is unreachable", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)

    await promote()

    expect(getLocalConfigMock).not.toHaveBeenCalled()
    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("keeps a provider the user already chose and only fills the untouched slots", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)
    const config = structuredClone(DEFAULT_CONFIG)
    config.translate.providerId = "openai-default"
    getLocalConfigMock.mockResolvedValue(config)

    await promote()

    const written = setLocalConfigMock.mock.calls[0]?.[0] as Config
    expect(translateProviderIdsOf(written)).toEqual([
      "openai-default",
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
    ])
  })

  it("does not write when no feature is on the Microsoft default any more", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)
    const config = structuredClone(DEFAULT_CONFIG)
    config.translate.providerId = "openai-default"
    config.selectionToolbar.features.translate.providerId = "openai-default"
    config.inputTranslation.providerId = "openai-default"
    config.videoSubtitles.providerId = "openai-default"
    getLocalConfigMock.mockResolvedValue(config)

    await promote()

    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("preserves the rest of the config", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)
    const config = structuredClone(DEFAULT_CONFIG)
    config.language.targetCode = "jpn"
    config.translate.page.autoTranslatePatterns = ["example.com"]
    getLocalConfigMock.mockResolvedValue(config)

    await promote()

    const written = setLocalConfigMock.mock.calls[0]?.[0] as Config
    expect(written.language.targetCode).toBe("jpn")
    expect(written.translate.page.autoTranslatePatterns).toEqual(["example.com"])
    expect(written.translate.mode).toBe(DEFAULT_CONFIG.translate.mode)
    expect(MICROSOFT_TRANSLATE_PROVIDER_ID).not.toBe(written.translate.providerId)
  })
})
