// @vitest-environment jsdom
import type { YoutubeMode } from "../config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subtitlesStore, subtitlesVisibleAtom } from "../../../atoms"
import { UniversalVideoAdapter } from "../../../universal-adapter"
import { getYoutubeConfig } from "../config"

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

vi.mock("@/entrypoints/subtitles.content/renderer/render-translate-button", () => ({
  renderSubtitlesTranslateButton: () => document.createElement("div"),
}))

type Layout = Exclude<YoutubeMode, "embed">

const VIDEO_ID = "aqz-KE-bpKQ"
const LAYOUT_URLS: Record<Layout, string> = {
  watch: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  shorts: `https://www.youtube.com/shorts/${VIDEO_ID}`,
}

/** A layout's page as YouTube builds it: its own player, holding its own video. */
function appendLayout(layout: Layout, duration: number): HTMLVideoElement {
  const video = document.createElement("video")
  video.className = "html5-main-video"
  Object.defineProperty(video, "duration", { value: duration })
  const player = document.createElement("div")
  player.className = "html5-video-player"
  player.append(video)

  if (layout === "watch") {
    player.id = "movie_player"
    const controls = document.createElement("div")
    controls.className = "ytp-right-controls"
    player.append(controls)
    const page = document.createElement("ytd-watch-flexy")
    page.append(player)
    document.body.append(page)
  } else {
    player.id = "shorts-player"
    const overlay = document.createElement("div")
    overlay.id = "reel-overlay-container"
    overlay.append(player)
    const page = document.createElement("ytd-shorts")
    page.append(overlay)
    document.body.append(page)
  }
  return video
}

function createFetcher() {
  return {
    fetch: vi.fn<(...args: any[]) => any>().mockResolvedValue([]),
    cleanup: vi.fn<(...args: any[]) => any>(),
    shouldUseSameTrack: vi.fn<(...args: any[]) => any>().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn<(...args: any[]) => any>().mockResolvedValue(true),
  }
}

// YouTube keeps the layout it left hidden in the page, ahead of the one now shown, and builds a
// hidden watch page on the home page before Shorts is opened from there.
describe.each([
  { shown: "shorts", hidden: "watch" },
  { shown: "watch", hidden: "shorts" },
] as const)("youtube $shown page behind a hidden $hidden player", ({ shown, hidden }) => {
  const originalLocation = window.location
  let shownVideo: HTMLVideoElement
  let adapter: UniversalVideoAdapter | null = null

  beforeEach(() => {
    mocks.getLocalConfig.mockResolvedValue(null)
    Object.defineProperty(window, "location", {
      value: new URL(LAYOUT_URLS[shown]),
      writable: true,
    })
    appendLayout(hidden, 600)
    shownVideo = appendLayout(shown, 30)
  })

  afterEach(() => {
    adapter?.destroy()
    adapter = null
    document.body.innerHTML = ""
    Object.defineProperty(window, "location", { value: originalLocation, writable: true })
    vi.restoreAllMocks()
  })

  it("turns subtitles on over the video on screen", async () => {
    const created = new UniversalVideoAdapter({
      config: getYoutubeConfig({ mode: shown }),
      fetchers: { native: createFetcher },
    })
    adapter = created
    vi.spyOn((created as any).starter, "startTranslation").mockResolvedValue(true)
    void created.initialize()

    await vi.waitFor(() => expect(created.getVideoElement()).toBe(shownVideo))
    created.toggleSubtitlesManually(true)

    expect(subtitlesStore.get(subtitlesVisibleAtom)).toBe(true)
  })

  it("claims the length of the video on screen for AI subtitles", () => {
    expect(getYoutubeConfig({ mode: shown }).createAiSubtitlesContext?.()).toMatchObject({
      videoId: VIDEO_ID,
      durationSec: 30,
    })
  })
})
