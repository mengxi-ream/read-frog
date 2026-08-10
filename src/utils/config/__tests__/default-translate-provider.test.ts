import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { GOOGLE_TRANSLATE_PROVIDER_ID } from "@/utils/constants/providers"

const isGoogleTranslateReachableMock = vi.fn<(...args: any[]) => any>()
const getLocalConfigAndMetaMock = vi.fn<(...args: any[]) => any>()
const setLocalConfigMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/host/translate/api/google", () => ({
  isGoogleTranslateReachable: isGoogleTranslateReachableMock,
}))

vi.mock("../storage", () => ({
  getLocalConfigAndMeta: getLocalConfigAndMetaMock,
  setLocalConfig: setLocalConfigMock,
}))

function translateProviderIdsOf(config: Config) {
  return [
    config.pageTranslation.providerId,
    config.selectionToolbar.features.translate.providerId,
    config.inputTranslation.providerId,
    config.videoSubtitles.providerId,
  ]
}

async function selectFreshProviders() {
  const { selectFreshTranslateProviders } = await import("../default-translate-provider")
  await selectFreshTranslateProviders()
}

describe("selectFreshTranslateProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLocalConfigAndMetaMock.mockResolvedValue({
      value: structuredClone(DEFAULT_CONFIG),
      meta: { schemaVersion: 95, lastModifiedAt: 100 },
    })
    setLocalConfigMock.mockResolvedValue(undefined)
  })

  it("promotes Google on every translate feature when the probe reaches it", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)

    await selectFreshProviders()

    expect(setLocalConfigMock).toHaveBeenCalledTimes(1)
    const written = setLocalConfigMock.mock.calls[0]?.[0] as Config
    expect(translateProviderIdsOf(written)).toEqual([
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
    ])
  })

  it("keeps a provider the user already chose and only fills the untouched slots", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)
    const config = structuredClone(DEFAULT_CONFIG)
    config.pageTranslation.providerId = "openai-default"
    getLocalConfigAndMetaMock.mockResolvedValue({
      value: config,
      meta: { schemaVersion: 95, lastModifiedAt: 100 },
    })

    await selectFreshProviders()

    const written = setLocalConfigMock.mock.calls[0]?.[0] as Config
    expect(translateProviderIdsOf(written)).toEqual([
      "openai-default",
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
      GOOGLE_TRANSLATE_PROVIDER_ID,
    ])
  })

  it("writes nothing when every slot already left the Microsoft default", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)
    const config = structuredClone(DEFAULT_CONFIG)
    config.pageTranslation.providerId = "openai-default"
    config.selectionToolbar.features.translate.providerId = "openai-default"
    config.inputTranslation.providerId = "openai-default"
    config.videoSubtitles.providerId = "openai-default"
    getLocalConfigAndMetaMock.mockResolvedValue({
      value: config,
      meta: { schemaVersion: 95, lastModifiedAt: 100 },
    })

    await selectFreshProviders()

    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("keeps the Microsoft default untouched when Google is unreachable", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)

    await selectFreshProviders()

    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("preserves unrelated config while promoting the untouched defaults", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)
    const config = structuredClone(DEFAULT_CONFIG)
    config.language.targetCode = "jpn"
    config.pageTranslation.page.autoTranslatePatterns = ["example.com"]
    getLocalConfigAndMetaMock.mockResolvedValue({
      value: config,
      meta: { schemaVersion: 95, lastModifiedAt: 100 },
    })

    await selectFreshProviders()

    const written = setLocalConfigMock.mock.calls[0]?.[0] as Config
    expect(written.language.targetCode).toBe("jpn")
    expect(written.pageTranslation.page.autoTranslatePatterns).toEqual(["example.com"])
    expect(written.pageTranslation.providerId).toBe(GOOGLE_TRANSLATE_PROVIDER_ID)
  })
})
