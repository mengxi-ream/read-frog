import { describe, expect, it, vi } from "vitest"
import { UniversalVideoAdapter } from "../universal-adapter"

function createAdapter(fetchResult: Array<{ text: string, start: number, end: number }>) {
  return new UniversalVideoAdapter({
    config: {
      selectors: {
        video: "video",
        playerContainer: ".player",
        controlsBar: ".controls",
        nativeSubtitles: ".native-subtitles",
      },
      events: {},
    },
    subtitlesFetcher: {
      fetch: vi.fn().mockResolvedValue(fetchResult),
      cleanup: vi.fn(),
      shouldUseSameTrack: vi.fn().mockResolvedValue(false),
      getSourceLanguage: () => "en",
      hasAvailableSubtitles: vi.fn().mockResolvedValue(true),
    },
  })
}

describe("universalVideoAdapter", () => {
  it("keeps raw source subtitles and rebuilds processed source subtitles", async () => {
    const subtitles = [
      { text: "I agree.", start: 0, end: 500 },
      { text: "It is true.", start: 500, end: 1000 },
      { text: "We can do this.", start: 1000, end: 1500 },
      { text: "Let's ship now.", start: 1500, end: 2000 },
    ]
    const adapter = createAdapter(subtitles)

    await (adapter as any).getOrLoadSourceSubtitles()

    expect((adapter as any).sourceSubtitles).toEqual(subtitles)
    expect((adapter as any).sourceProcessedSubtitles).toEqual([
      {
        text: "I agree. It is true. We can do this. Let's ship now.",
        start: 0,
        end: 2000,
      },
    ])
  })
})
