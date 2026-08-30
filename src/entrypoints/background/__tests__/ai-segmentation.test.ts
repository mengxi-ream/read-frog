import { beforeEach, describe, expect, it, vi } from "vitest"

const generateTextForProviderRefMock = vi.fn<(...args: any[]) => any>()
const cacheGetMock = vi.fn<(...args: any[]) => any>()
const cachePutMock = vi.fn<(...args: any[]) => any>()
const cacheDeleteMock = vi.fn<(...args: any[]) => any>()

vi.mock("../background-stream", () => ({
  generateTextForProviderRef: generateTextForProviderRefMock,
}))

vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    aiSegmentationCache: {
      get: cacheGetMock,
      put: cachePutMock,
      delete: cacheDeleteMock,
    },
  },
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    info: vi.fn<(...args: any[]) => any>(),
    error: vi.fn<(...args: any[]) => any>(),
  },
}))

// The trust-boundary guard is real here, so the fixture must name a provider
// that actually has a model to prompt.
const providerRef = {
  kind: "local" as const,
  config: { id: "openai-default", provider: "openai" } as never,
}
const jsonContent = JSON.stringify([{ s: 1000, e: 2000, t: "hello world" }])

const parseableVtt = "WEBVTT\n\n1000 --> 2000\nHello world."
// A refusal/garbage answer: cleaning prepends WEBVTT but it still has no cues.
const unparseableAnswer = "Sorry, I cannot segment this."

describe("runAiSegmentSubtitles result validation", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    cacheGetMock.mockResolvedValue(undefined)
  })

  it("caches and returns a fresh result that parses to cues", async () => {
    generateTextForProviderRefMock.mockResolvedValue(`\`\`\`vtt\n${parseableVtt}\n\`\`\``)

    const { runAiSegmentSubtitles } = await import("../ai-segmentation")
    const result = await runAiSegmentSubtitles({ jsonContent, providerRef })

    expect(result).toBe(parseableVtt)
    expect(cachePutMock).toHaveBeenCalledWith(expect.objectContaining({ result: parseableVtt }))
  })

  it("throws without caching when the result yields no cues", async () => {
    generateTextForProviderRefMock.mockResolvedValue(unparseableAnswer)

    const { runAiSegmentSubtitles } = await import("../ai-segmentation")

    await expect(runAiSegmentSubtitles({ jsonContent, providerRef })).rejects.toThrow(/unparseable/)
    expect(cachePutMock).not.toHaveBeenCalled()
  })

  it("returns a parseable cached result without regenerating", async () => {
    cacheGetMock.mockResolvedValue({ result: parseableVtt })

    const { runAiSegmentSubtitles } = await import("../ai-segmentation")
    const result = await runAiSegmentSubtitles({ jsonContent, providerRef })

    expect(result).toBe(parseableVtt)
    expect(generateTextForProviderRefMock).not.toHaveBeenCalled()
    expect(cacheDeleteMock).not.toHaveBeenCalled()
  })

  it("drops an unparseable cached entry and regenerates", async () => {
    // An entry poisoned before results were parse-checked must not be served
    // forever; it is deleted and the chunk regenerated.
    cacheGetMock.mockResolvedValue({ result: `WEBVTT\n\n${unparseableAnswer}` })
    generateTextForProviderRefMock.mockResolvedValue(parseableVtt)

    const { runAiSegmentSubtitles } = await import("../ai-segmentation")
    const result = await runAiSegmentSubtitles({ jsonContent, providerRef })

    expect(cacheDeleteMock).toHaveBeenCalledTimes(1)
    expect(generateTextForProviderRefMock).toHaveBeenCalledTimes(1)
    expect(result).toBe(parseableVtt)
    expect(cachePutMock).toHaveBeenCalledWith(expect.objectContaining({ result: parseableVtt }))
  })
})
