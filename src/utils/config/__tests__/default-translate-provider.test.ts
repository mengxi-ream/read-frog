import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"
import {
  GOOGLE_TRANSLATE_PROVIDER_ID,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "@/utils/constants/providers"

const isGoogleTranslateReachableMock = vi.fn<(...args: any[]) => any>()
const getLocalConfigAndMetaMock = vi.fn<(...args: any[]) => any>()
const setLocalConfigMock = vi.fn<(...args: any[]) => any>()
const hostedAiStatusMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/host/translate/api/google", () => ({
  isGoogleTranslateReachable: isGoogleTranslateReachableMock,
}))

vi.mock("@/utils/orpc/background-client", () => ({
  backgroundOrpcClient: {
    hostedAi: { status: hostedAiStatusMock },
  },
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

function hostedStatus(normalAvailable: boolean) {
  const tiers = {
    normal: {
      accessAllowed: normalAvailable,
      available: normalAvailable,
      unavailableReason: normalAvailable ? null : "authentication_required",
      modelRevision: "normal-r1",
    },
    ultra: {
      accessAllowed: normalAvailable,
      available: normalAvailable,
      unavailableReason: normalAvailable ? null : "authentication_required",
      modelRevision: "ultra-r1",
    },
  }
  return {
    credits: normalAvailable
      ? [
          {
            periodKind: "weekly",
            usedPercent: 0,
            resetAt: "2026-08-11T00:00:00.000Z",
            features: ["pageTranslation", "customAction", "noteSuggestion"],
          },
        ]
      : [],
    features: {
      pageTranslation: tiers,
      customAction: tiers,
      noteSuggestion: tiers,
    },
  }
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
    hostedAiStatusMock.mockResolvedValue(hostedStatus(true))
  })

  it("promotes Google on every translate feature when the probe reaches it", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)

    await selectFreshProviders()

    expect(hostedAiStatusMock).not.toHaveBeenCalled()
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

  it("switches only page translation when Google is unreachable and Normal is available", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)

    await selectFreshProviders()

    expect(hostedAiStatusMock).toHaveBeenCalledWith({})
    const written = setLocalConfigMock.mock.calls[0]?.[0] as Config
    expect(translateProviderIdsOf(written)).toEqual([
      BUILT_IN_AI_PROVIDER_ID,
      MICROSOFT_TRANSLATE_PROVIDER_ID,
      MICROSOFT_TRANSLATE_PROVIDER_ID,
      MICROSOFT_TRANSLATE_PROVIDER_ID,
    ])
  })

  it("silently keeps Microsoft for a guest", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)
    hostedAiStatusMock.mockResolvedValue(hostedStatus(false))

    await selectFreshProviders()

    expect(getLocalConfigAndMetaMock).toHaveBeenCalledTimes(1)
    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("silently keeps Microsoft for a signed-in user without page funding", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)
    const status = hostedStatus(false)
    status.features.pageTranslation.normal.accessAllowed = true
    status.features.pageTranslation.normal.unavailableReason = "service_unavailable"
    hostedAiStatusMock.mockResolvedValue(status)

    await selectFreshProviders()

    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("still selects Built-in AI for an entitled user whose credit is exhausted", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)
    const status = hostedStatus(false)
    status.features.pageTranslation.normal.accessAllowed = true
    status.features.pageTranslation.normal.unavailableReason = "quota_exhausted"
    status.credits = [
      {
        periodKind: "weekly",
        usedPercent: 100,
        resetAt: "2026-08-11T00:00:00.000Z",
        features: ["pageTranslation", "customAction", "noteSuggestion"],
      },
    ]
    hostedAiStatusMock.mockResolvedValue(status)

    await selectFreshProviders()

    const written = setLocalConfigMock.mock.calls[0]?.[0] as Config
    expect(written.pageTranslation.providerId).toBe(BUILT_IN_AI_PROVIDER_ID)
  })

  it("silently keeps Microsoft when the entitlement check fails", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)
    hostedAiStatusMock.mockRejectedValue(new Error("offline"))

    await selectFreshProviders()

    expect(getLocalConfigAndMetaMock).toHaveBeenCalledTimes(1)
    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("does not overwrite a provider selected while probes were in flight", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)
    const config = structuredClone(DEFAULT_CONFIG)
    config.pageTranslation.providerId = "openai-default"
    getLocalConfigAndMetaMock
      .mockResolvedValueOnce({
        value: structuredClone(DEFAULT_CONFIG),
        meta: { schemaVersion: 95, lastModifiedAt: 100 },
      })
      .mockResolvedValueOnce({
        value: config,
        meta: { schemaVersion: 95, lastModifiedAt: 200 },
      })

    await selectFreshProviders()

    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("does not overwrite Microsoft when any config edit changed the modification version", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)
    const edited = structuredClone(DEFAULT_CONFIG)
    edited.language.targetCode = "jpn"
    getLocalConfigAndMetaMock
      .mockResolvedValueOnce({
        value: structuredClone(DEFAULT_CONFIG),
        meta: { schemaVersion: 95, lastModifiedAt: 100 },
      })
      .mockResolvedValueOnce({
        value: edited,
        meta: { schemaVersion: 95, lastModifiedAt: 200 },
      })

    await selectFreshProviders()

    expect(setLocalConfigMock).not.toHaveBeenCalled()
  })

  it("preserves unrelated config while switching the untouched page default", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)
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
  })
})
