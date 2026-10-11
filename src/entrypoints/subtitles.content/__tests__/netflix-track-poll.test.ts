import type { NetflixSubtitlesResponse } from "@/utils/subtitles/fetchers/netflix"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NetflixSubtitlesFetcher } from "@/utils/subtitles/fetchers/netflix"
import { UniversalVideoAdapter } from "../universal-adapter"

const page = vi.hoisted(() => ({
  answer: (_action: string): Promise<unknown> => Promise.resolve(null),
}))
const postMessageRequest = vi.hoisted(() =>
  vi.fn<(type: string, message: { action: string }) => Promise<unknown>>((_type, message) =>
    page.answer(message.action),
  ),
)
vi.mock("@/utils/subtitles/fetchers/post-message-request", () => ({ postMessageRequest }))

vi.mock("@/utils/config/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/config/storage")>()),
  getLocalConfig: async () => ({
    language: {},
    providersConfig: [],
    videoSubtitles: { aiSegmentation: false, providerId: null },
  }),
}))

// What the page script reports: the selected track, whose subtitle file it never captured.
function pageReply(overrides: Partial<NetflixSubtitlesResponse> = {}): NetflixSubtitlesResponse {
  return {
    type: "response",
    requestId: "1",
    movieId: 1,
    trackId: "T:en",
    translatable: true,
    ttml: null,
    ...overrides,
  }
}

function loadRequests() {
  return postMessageRequest.mock.calls.filter(([, message]) => message.action === "load").length
}

// Subtitles are on, so every Netflix poll tick reaches the fetcher's track check.
function createNetflixAdapter() {
  const adapter = new UniversalVideoAdapter({
    config: { selectors: { video: "video", playerContainer: ".player" }, events: {} },
    fetchers: { native: () => new NetflixSubtitlesFetcher() },
  })
  const scheduler = {
    isActive: () => true,
    reset: vi.fn<() => void>(),
    stop: vi.fn<() => void>(),
    setState: vi.fn<(state: string, data?: { message?: string }) => void>(),
    supplementSubtitles: vi.fn<() => void>(),
    getVideoElement: () => ({ currentTime: 0 }),
    getState: () => "idle",
  }
  ;(adapter as any).subtitlesScheduler = scheduler
  return { adapter, scheduler }
}

describe("Netflix track poll", () => {
  beforeEach(() => {
    postMessageRequest.mockClear()
  })

  it("leaves a failed load's error on screen while the same track stays selected", async () => {
    page.answer = async () => pageReply()
    const { adapter, scheduler } = createNetflixAdapter()
    await (adapter as any).startTranslation()
    expect(scheduler.setState).toHaveBeenLastCalledWith("error", {
      message: "subtitles.errors.trackFileNotLoaded",
    })
    scheduler.reset.mockClear()
    scheduler.setState.mockClear()

    await adapter.handleSourceTrackChanged()
    await adapter.handleSourceTrackChanged()

    expect(scheduler.reset).not.toHaveBeenCalled()
    expect(scheduler.setState).not.toHaveBeenCalled()
    expect(loadRequests()).toBe(1)
  })

  it("loads again after a failure once the viewer picks another track", async () => {
    page.answer = async () => pageReply()
    const { adapter, scheduler } = createNetflixAdapter()
    await (adapter as any).startTranslation()

    page.answer = async () => pageReply({ trackId: "T:ja" })
    await adapter.handleSourceTrackChanged()

    expect(scheduler.setState).toHaveBeenCalledWith("loading")
    expect(loadRequests()).toBe(2)
  })

  it("lets a load that is still running finish instead of starting another", async () => {
    let finishLoad!: (reply: NetflixSubtitlesResponse) => void
    const firstLoad = new Promise<NetflixSubtitlesResponse>((resolve) => {
      finishLoad = resolve
    })
    let loads = 0
    page.answer = (action) =>
      action === "load" && ++loads === 1 ? firstLoad : Promise.resolve(pageReply())
    const { adapter, scheduler } = createNetflixAdapter()
    const starting = (adapter as any).startTranslation()
    await vi.waitFor(() => expect(loadRequests()).toBe(1))
    scheduler.reset.mockClear()

    await adapter.handleSourceTrackChanged()

    expect(scheduler.reset).not.toHaveBeenCalled()
    expect(loadRequests()).toBe(1)

    finishLoad(pageReply())
    await starting
  })
})
