// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  NAVIGATION_HANDLER_DELAY,
  SUBTITLES_SOURCE,
  TRANSLATE_BUTTON_CONTAINER_ID,
} from "@/utils/constants/subtitles"
import {
  currentVideoIdAtom,
  subtitlesSettingsPanelOpenAtom,
  subtitlesSourceAtom,
  subtitlesStore,
  subtitlesVisibleAtom,
} from "../atoms"
import { UniversalVideoAdapter } from "../universal-adapter"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/config/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/config/storage")>()
  return {
    ...actual,
    getLocalConfig: mocks.getLocalConfig,
  }
})

vi.mock("@/utils/subtitles/toast", () => ({
  showSubtitlesErrorToast: vi.fn<(...args: any[]) => any>(),
  showAiSubtitlesWallToast: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/subtitles/processor/translator", () => ({
  buildSubtitlesSummaryContextHash: vi.fn<(...args: any[]) => any>(() => null),
  resolveSubtitlesProviderRef: vi.fn<(...args: any[]) => any>(),
  fetchSubtitlesSummary: vi.fn<(...args: any[]) => any>(),
  translateSubtitles: vi.fn<(...args: any[]) => any>(),
}))

const NAVIGATE_START = "test-navigate-start"
const NAVIGATE_FINISH = "test-navigate-finish"

function createAdapter() {
  const fetcher = {
    fetch: vi.fn<(...args: any[]) => any>().mockResolvedValue([]),
    cleanup: vi.fn<(...args: any[]) => any>(),
    shouldUseSameTrack: vi.fn<(...args: any[]) => any>().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn<(...args: any[]) => any>().mockResolvedValue(true),
  }
  const native = vi.fn<(...args: any[]) => any>(() => fetcher)

  const adapter = new UniversalVideoAdapter({
    config: {
      platform: "youtube",
      selectors: {
        video: "video",
        playerContainer: ".player",
        nativeSubtitles: ".native-subtitles",
      },
      events: { navigateStart: NAVIGATE_START, navigateFinish: NAVIGATE_FINISH },
      getVideoId: () => "video-1",
    },
    fetchers: { native },
  })

  return { adapter, fetcher, native }
}

describe("universalVideoAdapter destroy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [],
      videoSubtitles: {
        autoStart: { youtube: false, xcom: false, netflix: false },
        providerId: null,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("releases the page, resets shared state and ignores later navigation", () => {
    document.body.innerHTML = `<div id="${TRANSLATE_BUTTON_CONTAINER_ID}"></div>`
    const { adapter, fetcher, native } = createAdapter()
    const scheduler = {
      reset: vi.fn<(...args: any[]) => any>(),
      stop: vi.fn<(...args: any[]) => any>(),
      isActive: () => true,
      setState: vi.fn<(...args: any[]) => any>(),
    }
    ;(adapter as any).subtitlesScheduler = scheduler
    ;(adapter as any).setupNavigationListeners()
    subtitlesStore.set(subtitlesSourceAtom, SUBTITLES_SOURCE.AI)
    subtitlesStore.set(subtitlesVisibleAtom, true)
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, true)
    subtitlesStore.set(currentVideoIdAtom, "video-1")
    const removeEventListener = vi.spyOn(window, "removeEventListener")

    adapter.destroy()

    expect(document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)).toBeNull()
    expect(fetcher.cleanup).toHaveBeenCalled()
    expect(scheduler.stop).toHaveBeenCalled()
    expect(subtitlesStore.get(subtitlesSourceAtom)).toBe(SUBTITLES_SOURCE.NATIVE)
    expect(subtitlesStore.get(subtitlesVisibleAtom)).toBe(false)
    expect(subtitlesStore.get(subtitlesSettingsPanelOpenAtom)).toBe(false)
    expect(subtitlesStore.get(currentVideoIdAtom)).toBeNull()
    expect(removeEventListener).toHaveBeenCalledWith(NAVIGATE_START, expect.any(Function))
    expect(removeEventListener).toHaveBeenCalledWith(NAVIGATE_FINISH, expect.any(Function))

    vi.useFakeTimers()
    const fetcherBuilds = native.mock.calls.length
    adapter.notifyNavigation()
    window.dispatchEvent(new Event(NAVIGATE_START))
    window.dispatchEvent(new Event(NAVIGATE_FINISH))
    vi.advanceTimersByTime(NAVIGATION_HANDLER_DELAY + 1)
    expect(native).toHaveBeenCalledTimes(fetcherBuilds)
    expect((adapter as any).subtitlesScheduler).toBeNull()
  })

  it("backs out of an initialize that resumes after destroy", async () => {
    document.body.innerHTML = '<div class="player"><video></video></div>'
    const { adapter } = createAdapter()
    const addEventListener = vi.spyOn(window, "addEventListener")

    const initializing = adapter.initialize()
    adapter.destroy()
    await initializing

    expect((adapter as any).subtitlesScheduler).toBeNull()
    expect(addEventListener).not.toHaveBeenCalledWith(NAVIGATE_START, expect.anything())
    expect(addEventListener).not.toHaveBeenCalledWith(NAVIGATE_FINISH, expect.anything())
  })
})
