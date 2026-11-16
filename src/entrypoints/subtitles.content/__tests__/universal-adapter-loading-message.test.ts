import type { SubtitlesFetcher } from "@/utils/subtitles/fetchers/types"
import { describe, expect, it, vi } from "vitest"
import { initI18n } from "@/utils/i18n"
import { UniversalVideoAdapter } from "../universal-adapter"

// Like the real facade, `t` returns "" until `initI18n` has run. The content script
// loads the subtitles runtime before it initializes i18n, as the import above does.
const i18nState = vi.hoisted(() => ({ initialized: false }))

vi.mock("@/utils/i18n", () => ({
  i18n: { t: (key: string) => (i18nState.initialized ? key : "") },
  initI18n: async () => {
    i18nState.initialized = true
  },
}))

function createFetcher(): SubtitlesFetcher {
  return {
    fetch: vi.fn<SubtitlesFetcher["fetch"]>().mockResolvedValue([]),
    cleanup: vi.fn<SubtitlesFetcher["cleanup"]>(),
    shouldUseSameTrack: vi.fn<SubtitlesFetcher["shouldUseSameTrack"]>().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi
      .fn<SubtitlesFetcher["hasAvailableSubtitles"]>()
      .mockResolvedValue(true),
  }
}

describe("the AI subtitles loading message", () => {
  it("is translated when shown, not when the adapter module loads", async () => {
    await initI18n()
    const adapter = new UniversalVideoAdapter({
      config: {
        platform: "youtube",
        selectors: {
          video: "video",
          playerContainer: ".player",
          nativeSubtitles: ".native-subtitles",
        },
        events: {},
      },
      fetchers: { native: createFetcher, ai: createFetcher },
    })
    const scheduler = {
      start: vi.fn<() => void>(),
      show: vi.fn<() => void>(),
      setState: vi.fn<(...args: unknown[]) => void>(),
    }
    ;(adapter as any).player.subtitlesScheduler = scheduler
    vi.spyOn((adapter as any).nativeCaptions, "hideNativeSubtitles").mockImplementation(() => {})
    vi.spyOn((adapter as any).starter, "startTranslation").mockResolvedValue(true)

    await adapter.requestAiSubtitles()

    expect(scheduler.setState).toHaveBeenCalledWith("loading", {
      message: "subtitles.loadingAiSubtitles",
    })
  })
})
