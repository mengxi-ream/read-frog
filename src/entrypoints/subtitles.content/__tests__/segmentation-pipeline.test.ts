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

    // The window ahead of the playhead is segmented...
    expect(segmentedStarts.has(0)).toBe(true)

    // ...and nothing beyond it. Chunks are kept a whole PROCESS_LOOK_AHEAD_MS wide and are
    // only started while their first fragment is within the look-ahead window, so the buffer
    // reaches at most two windows ahead of the playhead — not the rest of the video.
    const furthestSegmented = Math.max(...segmentedStarts)
    expect(furthestSegmented).toBeLessThan(2 * PROCESS_LOOK_AHEAD_MS)
    expect(pipeline.hasUnprocessedChunks()).toBe(true)
  })

  it("segments the next window once playback advances into it", async () => {
    const rawFragments = Array.from({ length: 600 }, (_, i) => ({
      text: `w${i}`,
      start: i * 1000,
      end: i * 1000 + 1000,
    }))

    let currentTime = 0
    const pipeline = new SegmentationPipeline({
      rawFragments,
      getVideoElement: () =>
        ({
          get currentTime() {
            return currentTime
          },
        }) as HTMLVideoElement,
      getSourceLanguage: () => "en",
      preSegmented: true,
    })

    await (pipeline as any).runLoop()
    const afterStart = Math.max(...((pipeline as any).segmentedRawStarts as Set<number>))

    // Playback moves into the buffered region; the pipeline should top the window back up
    // rather than stay starved behind its own bound.
    currentTime = 150
    await (pipeline as any).runLoop()
    const afterAdvance = Math.max(...((pipeline as any).segmentedRawStarts as Set<number>))

    expect(afterAdvance).toBeGreaterThan(afterStart)
    expect(afterAdvance).toBeLessThan(150_000 + 2 * PROCESS_LOOK_AHEAD_MS)
  })
})
