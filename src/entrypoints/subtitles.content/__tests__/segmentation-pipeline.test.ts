import { describe, expect, it, vi } from "vitest"
import { PROCESS_LOOK_AHEAD_MS } from "@/utils/constants/subtitles"
import { SegmentationPipeline } from "../segmentation-pipeline"

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn<(...args: any[]) => any>().mockResolvedValue({
    videoSubtitles: {
      aiSegmentation: true,
    },
  }),
}))

vi.mock("@/utils/subtitles/processor/ai-segmentation", () => ({
  aiSegmentBlock: vi.fn<(...args: any[]) => any>().mockRejectedValue(new Error("ai failed")),
}))

describe("segmentation pipeline", () => {
  it("replaces overlapping baseline fragments when AI fallback is used", async () => {
    const rawFragments = [
      { text: "hello", start: 0, end: 500 },
      { text: "world", start: 500, end: 1000 },
    ]

    const pipeline = new SegmentationPipeline({
      baselineFragments: [{ text: "hello world", start: 0, end: 1000 }],
      rawFragments,
      getVideoElement: () => ({ currentTime: 0 }) as HTMLVideoElement,
      getSourceLanguage: () => "en",
    })

    await (pipeline as any).processNextChunk(0)

    expect(pipeline.processedFragments).toEqual([{ text: "hello world", start: 0, end: 1000 }])
  })

  it("does not segment past the look-ahead window from the current position", async () => {
    // 10 minutes of word-level fragments, one per second.
    const rawFragments = Array.from({ length: 600 }, (_, i) => ({
      text: `w${i}`,
      start: i * 1000,
      end: i * 1000 + 1000,
    }))

    const pipeline = new SegmentationPipeline({
      rawFragments,
      // Playback stays at the very beginning (e.g. paused right after enabling).
      getVideoElement: () => ({ currentTime: 0 }) as HTMLVideoElement,
      getSourceLanguage: () => "en",
      preSegmented: true,
    })

    await (pipeline as any).runLoop()

    const segmentedStarts = (pipeline as any).segmentedRawStarts as Set<number>
    const furthestSegmented = Math.max(...segmentedStarts)

    // Only the look-ahead window ahead of the current position should be segmented,
    // not the whole remaining video. The rest waits until playback advances.
    expect(furthestSegmented).toBeLessThanOrEqual(2 * PROCESS_LOOK_AHEAD_MS)
    expect(pipeline.hasUnprocessedChunks()).toBe(true)
  })
})
