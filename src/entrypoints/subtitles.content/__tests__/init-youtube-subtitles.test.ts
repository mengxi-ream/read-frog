// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initYoutubeSubtitles } from "../init-youtube-subtitles"

const mocks = vi.hoisted(() => ({
  createYoutubeCaptionTrackListener: vi.fn(),
  createYoutubeSubtitlesAdapter: vi.fn(),
  mountSubtitlesUI: vi.fn(),
  watchShortsActiveReel: vi.fn(),
}))

vi.mock("../platforms/youtube", () => ({
  createYoutubeSubtitlesAdapter: mocks.createYoutubeSubtitlesAdapter,
}))

vi.mock("../platforms/youtube/caption-track-listener", () => ({
  createYoutubeCaptionTrackListener: mocks.createYoutubeCaptionTrackListener,
}))

vi.mock("../platforms/youtube/shorts-active-reel-watcher", () => ({
  watchShortsActiveReel: mocks.watchShortsActiveReel,
}))

vi.mock("../renderer/mount-subtitles-ui", () => ({
  mountSubtitlesUI: mocks.mountSubtitlesUI,
}))

function setLocation(href: string) {
  const url = new URL(href)
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      href,
      hostname: url.hostname,
      pathname: url.pathname,
    },
  })
}

describe("initYoutubeSubtitles", () => {
  beforeEach(() => {
    mocks.createYoutubeCaptionTrackListener.mockReset()
    mocks.createYoutubeCaptionTrackListener.mockReturnValue({ start: vi.fn() })
    mocks.createYoutubeSubtitlesAdapter.mockReset()
    mocks.createYoutubeSubtitlesAdapter.mockReturnValue({
      initialize: vi.fn(),
      notifyNavigation: vi.fn(),
    })
    mocks.mountSubtitlesUI.mockReset()
    mocks.mountSubtitlesUI.mockResolvedValue(undefined)
    mocks.watchShortsActiveReel.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("does not initialize YouTube subtitles on x.com status paths that look like YouTube shorts", async () => {
    setLocation("https://x.com/shorts/status/1234567890")

    initYoutubeSubtitles()
    await Promise.resolve()

    expect(mocks.createYoutubeSubtitlesAdapter).not.toHaveBeenCalled()
    expect(mocks.mountSubtitlesUI).not.toHaveBeenCalled()
    expect(mocks.watchShortsActiveReel).not.toHaveBeenCalled()
  })
})
