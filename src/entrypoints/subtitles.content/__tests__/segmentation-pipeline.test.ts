import { describe, expect, it, vi } from "vitest"

import { SegmentationPipeline } from "../segmentation-pipeline"

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn().mockResolvedValue({
    videoSubtitles: {
      aiSegmentation: true,
    },
  }),
}))

vi.mock("@/utils/subtitles/processor/ai-segmentation", () => ({
  aiSegmentBlock: vi.fn().mockRejectedValue(new Error("ai failed")),
}))

describe("segmentation pipeline", () => {
  it("replaces overlapping baseline fragments when AI fallback is used", async () => {
    const rawFragments = [
      { text: "hello", start: 0, end: 500 },
      { text: "world", start: 500, end: 1000 },
    ]

    const pipeline = new SegmentationPipeline({
      baselineFragments: [
        { text: "hello world", start: 0, end: 1000 },
      ],
      rawFragments,
      getVideoElement: () => ({ currentTime: 0 } as HTMLVideoElement),
      getSourceLanguage: () => "en",
    })

    await (pipeline as any).processNextChunk(0)

    expect(pipeline.processedFragments).toEqual([
      { text: "hello world", start: 0, end: 1000 },
    ])
  })
})
