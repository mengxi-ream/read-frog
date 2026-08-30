import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"

const getLocalConfigMock = vi.fn<(...args: any[]) => any>()
const sendMessageMock = vi.fn<(...args: any[]) => any>()
const serializeProviderRefMock = vi.fn<(...args: any[]) => any>()
const toastAddMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: getLocalConfigMock,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: (...args: unknown[]) => toastAddMock(...args) },
}))

// Only the network-touching resolve is replaced; canProviderRefGenerateText
// must stay real, because the task gate under test is built on it.
vi.mock("@/utils/providers/provider-ref", async () => {
  const actual = await vi.importActual<any>("@/utils/providers/provider-ref")
  return { ...actual, serializeProviderRef: serializeProviderRefMock }
})

const GOOGLE = DEFAULT_PROVIDER_CONFIG["google-translate"]

function configWithProvider(provider: { id: string }) {
  return {
    ...DEFAULT_CONFIG,
    providersConfig: [provider],
    videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: provider.id },
  }
}

describe("subtitles task requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The real serialize unwraps the resolved ref; the mock must too, or a
    // LocalProviderRef would come back double-wrapped.
    serializeProviderRefMock.mockImplementation(async (ref: { config: unknown }) => ({
      kind: "local",
      config: ref.config,
    }))
  })

  it("resolves a translate-only provider for line translation but not for generation tasks", async () => {
    const { resolveSubtitlesProvider } = await import("../translator")
    const config = configWithProvider(GOOGLE) as never

    // The picker legally admits Google for videoSubtitles…
    await expect(resolveSubtitlesProvider(config, "lineTranslation")).resolves.toEqual({
      status: "ok",
      ref: { kind: "local", config: GOOGLE },
    })
    // …but a summary or a recut is a generation, and the resolution reports
    // that as its own state — with no ref a caller could misuse.
    await expect(resolveSubtitlesProvider(config, "summary")).resolves.toEqual({
      status: "notPromptable",
    })
    await expect(resolveSubtitlesProvider(config, "segmentation")).resolves.toEqual({
      status: "notPromptable",
    })
  })

  it("keeps notPromptable distinct from having no provider at all", async () => {
    const { resolveSubtitlesProvider } = await import("../translator")
    const config = {
      ...configWithProvider(GOOGLE),
      videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: "does-not-exist" },
    } as never

    await expect(resolveSubtitlesProvider(config, "summary")).resolves.toEqual({
      status: "none",
    })
  })

  it("degrades a generation task silently — no toast, no message", async () => {
    const { resolveSubtitlesProviderRef } = await import("../translator")
    const config = configWithProvider(GOOGLE) as never

    await expect(resolveSubtitlesProviderRef(config, "segmentation")).resolves.toBeNull()
    // Unlike a hosted denial (something the user was refused), an unpromptable
    // provider is a configuration state the pre-flight UI explains; the run
    // itself falls back without announcing.
    expect(toastAddMock).not.toHaveBeenCalled()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it("uses a passed-through session ref for the summary instead of re-resolving", async () => {
    const { fetchSubtitlesSummary } = await import("../translator")
    const config = {
      ...configWithProvider(GOOGLE),
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, enableAIContentAware: true },
    } as never
    const sessionRef = { kind: "local" as const, config: DEFAULT_PROVIDER_CONFIG.openai }
    sendMessageMock.mockResolvedValue("a summary")

    const summary = await fetchSubtitlesSummary(
      { videoTitle: "V", subtitlesTextContent: "text" },
      config,
      sessionRef,
    )

    expect(summary).toBe("a summary")
    // A re-resolve could mint a different cache identity mid-session; the
    // session's own ref must be the one that rides the message.
    expect(serializeProviderRefMock).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledWith(
      "getSubtitlesSummary",
      expect.objectContaining({ providerRef: sessionRef }),
    )
  })

  it("skips the summary outright when the session narrowed its ref to null", async () => {
    const { fetchSubtitlesSummary } = await import("../translator")
    const config = {
      ...configWithProvider(GOOGLE),
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, enableAIContentAware: true },
    } as never

    await expect(
      fetchSubtitlesSummary({ videoTitle: "V", subtitlesTextContent: "text" }, config, null),
    ).resolves.toBeNull()

    expect(serializeProviderRefMock).not.toHaveBeenCalled()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
