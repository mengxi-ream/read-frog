import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

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

// Only the network-touching resolve is replaced; the error class and the cache
// identity helper must stay real, since the assertions are about them.
vi.mock("@/utils/providers/provider-ref", async () => {
  const actual = await vi.importActual<any>("@/utils/providers/provider-ref")
  return { ...actual, serializeProviderRef: serializeProviderRefMock }
})

const { HostedAiProviderUnavailableError } = await import("@/utils/providers/provider-ref")
const { getBuiltInAiRefusalKind } = await import("@/utils/hosted-ai/refusal")

const BUILT_IN_PROVIDER = {
  kind: "system" as const,
  id: "read-frog-ai:gpt-6-luna" as const,
  name: "GPT-6 Luna",
  model: "gpt-6-luna",
}

describe("subtitles provider ref resolution under a hosted denial", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLocalConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: "read-frog-ai:gpt-6-luna",
      },
    })
  })

  it("tells the user why the cues came back untranslated instead of blanking silently", async () => {
    serializeProviderRefMock.mockRejectedValue(
      new HostedAiProviderUnavailableError(BUILT_IN_PROVIDER, "Weekly credit used up"),
    )
    const { translateSubtitles } = await import("../translator")

    const fragments = [
      { text: "hello", start: 0, end: 1_000 },
      { text: "world", start: 1_000, end: 2_000 },
    ]
    const result = await translateSubtitles(fragments, { videoTitle: "V" } as never)

    // The degradation itself is deliberate — it must not throw into the
    // player's render path — but it is no longer silent.
    expect(result.map((f) => f.translation)).toEqual(["", ""])
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", title: "Weekly credit used up" }),
    )
  })

  it("raises one toast for a whole run, not one per cue batch", async () => {
    serializeProviderRefMock.mockRejectedValue(
      new HostedAiProviderUnavailableError(BUILT_IN_PROVIDER, "Weekly credit used up"),
    )
    const { translateSubtitles } = await import("../translator")

    // The coordinator re-resolves per batch, so a per-call toast would stack
    // one per five cues for the length of the video.
    for (let batch = 0; batch < 3; batch++) {
      await translateSubtitles([{ text: "x", start: batch, end: batch + 1 }], {
        videoTitle: "V",
      } as never)
    }

    const ids = toastAddMock.mock.calls.map((call) => (call[0] as { id?: string }).id)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(1)
    expect(ids[0]).toBeTruthy()
  })

  it("stays silent when no provider is configured at all", async () => {
    getLocalConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: "does-not-exist" },
    })
    const { translateSubtitles } = await import("../translator")

    const result = await translateSubtitles([{ text: "hello", start: 0, end: 1 }], {
      videoTitle: "V",
    } as never)

    // Not the same condition: nothing was denied, so there is nothing to
    // report to the user. This is the meaning the denial used to collapse into.
    expect(result.map((f) => f.translation)).toEqual([""])
    expect(toastAddMock).not.toHaveBeenCalled()
  })
})

describe("subtitles when Built-in AI refuses a guest or a spent pool", () => {
  const BUILT_IN_REF = { kind: "system", id: BUILT_IN_PROVIDER.id, model: "gpt-6-luna" }

  beforeEach(() => {
    vi.clearAllMocks()
    getLocalConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, enableAIContentAware: true },
      glossary: { ...DEFAULT_CONFIG.glossary, enabled: false },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: "read-frog-ai:gpt-6-luna",
      },
    })
  })

  it.each([
    ["a guest", "authentication_required", "logIn"],
    ["a spent pool", "quota_exhausted", "upgrade"],
  ] as const)(
    "throws the status check's refusal of %s instead of blanking the cues",
    async (_, reason, kind) => {
      const refusal = new HostedAiProviderUnavailableError(
        BUILT_IN_PROVIDER,
        "Weekly credit used up",
        undefined,
        reason,
      )
      serializeProviderRefMock.mockRejectedValue(refusal)
      const { translateSubtitles } = await import("../translator")

      const translating = translateSubtitles([{ text: "hello", start: 0, end: 1_000 }], {
        videoTitle: "V",
      } as never)

      // The coordinator asks to log in or upgrade, and keeps the cues to translate again.
      await expect(translating).rejects.toBe(refusal)
      expect(getBuiltInAiRefusalKind(refusal)).toBe(kind)
      expect(toastAddMock).not.toHaveBeenCalled()
      expect(sendMessageMock).not.toHaveBeenCalled()
    },
  )

  it("throws a batch the server refused a cue of mid-run, keeping the code to classify", async () => {
    serializeProviderRefMock.mockResolvedValue(BUILT_IN_REF)
    sendMessageMock.mockImplementation(async (type: string, data: { text: string }) => {
      if (type !== "enqueueSubtitlesTranslateRequest") return undefined
      if (data.text === "world") {
        throw Object.assign(new Error("Built-in AI quota used up"), {
          code: "HOSTED_AI_QUOTA_EXHAUSTED",
        })
      }
      return `t:${data.text}`
    })
    const { translateSubtitles } = await import("../translator")

    const error = await translateSubtitles(
      [
        { text: "hello", start: 0, end: 1_000 },
        { text: "world", start: 1_000, end: 2_000 },
      ],
      { videoTitle: "V", subtitlesTextContent: "hello world" },
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(Error)
    expect(getBuiltInAiRefusalKind(error)).toBe("upgrade")
  })

  it("keeps a refused summary to the toast: only line translation asks", async () => {
    const refusal = new HostedAiProviderUnavailableError(
      BUILT_IN_PROVIDER,
      "Weekly credit used up",
      { label: "Upgrade", url: "https://readfrog.app/pricing" },
      "quota_exhausted",
    )
    serializeProviderRefMock.mockRejectedValue(refusal)
    const { fetchSubtitlesSummary } = await import("../translator")

    const summary = await fetchSubtitlesSummary({
      videoTitle: "V",
      subtitlesTextContent: "hello world",
    })

    expect(summary).toBeNull()
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", title: "Weekly credit used up" }),
    )
  })
})
