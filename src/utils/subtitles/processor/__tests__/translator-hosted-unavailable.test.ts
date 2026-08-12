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

const BUILT_IN_PROVIDER = {
  kind: "system" as const,
  id: "read-frog-free-ai" as const,
  name: "Built-in AI",
  modelTier: "normal" as const,
}

describe("subtitles provider ref resolution under a hosted denial", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLocalConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: "read-frog-free-ai",
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
