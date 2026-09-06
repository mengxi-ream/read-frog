import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { requestVideoSummary } from "../video-summary"

vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundText: vi.fn<typeof streamBackgroundText>(),
}))

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))
vi.mock("@/utils/message", () => ({ sendMessage: sendMessageMock }))

const provider = { ...DEFAULT_PROVIDER_CONFIG.openai, temperature: 0.3 }
const config: Config = {
  ...DEFAULT_CONFIG,
  language: { ...DEFAULT_CONFIG.language, targetCode: "eng" },
  providersConfig: [provider],
  videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: provider.id },
}
const fragments = [{ text: "Video contents", start: 0, end: 1000 }]
const snapshot = {
  output: "## Title\n\nSummary",
  thinking: { status: "complete" as const, text: "" },
}

describe("video summary streaming request", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sendMessageMock.mockResolvedValue(null)
    vi.mocked(streamBackgroundText).mockResolvedValue(snapshot)
  })

  it("uses the same configuration snapshot for streaming and both cache operations", async () => {
    await expect(requestVideoSummary(fragments, config)).resolves.toBe("Summary")

    const providerRef = { kind: "local", config: provider }
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, "getCachedVideoSummary", {
      transcript: "Video contents",
      targetLanguage: "English",
      providerRef,
    })
    expect(streamBackgroundText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: provider.id,
        providerConfig: provider,
      }),
      expect.any(Object),
    )
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, "saveVideoSummary", {
      transcript: "Video contents",
      targetLanguage: "English",
      providerRef,
      summary: "Summary",
    })
  })

  it("returns cached summaries without opening a stream", async () => {
    sendMessageMock.mockResolvedValueOnce("Cached summary")
    await expect(requestVideoSummary(fragments, config)).resolves.toBe("Cached summary")
    expect(streamBackgroundText).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it("does not open a stream or return a cache hit after cancellation during the cache lookup", async () => {
    const controller = new AbortController()
    sendMessageMock.mockImplementationOnce(async () => {
      controller.abort()
      return "Cached summary"
    })

    await expect(
      requestVideoSummary(fragments, config, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(streamBackgroundText).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it("does not publish or cache a stream that completes after cancellation", async () => {
    const controller = new AbortController()
    const onChunk = vi.fn<(partial: string) => void>()
    vi.mocked(streamBackgroundText).mockImplementationOnce(async (_payload, options) => {
      controller.abort()
      options?.onChunk?.(snapshot)
      return snapshot
    })

    await expect(
      requestVideoSummary(fragments, config, { signal: controller.signal, onChunk }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(onChunk).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })
})
