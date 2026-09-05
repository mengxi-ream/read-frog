import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { requestVideoSummary } from "@/utils/subtitles/video-summary"
import { subtitlesStore, videoSummaryPartialAtom } from "../atoms"
import { UniversalVideoAdapter } from "../universal-adapter"

vi.mock("@/utils/subtitles/video-summary", () => ({
  requestVideoSummary: vi.fn<typeof requestVideoSummary>(),
  VIDEO_SUMMARY_QUERY_SCOPE: ["subtitles", "video-summary"],
}))

vi.mock("@/utils/config/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/config/storage")>()),
  getLocalConfig: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const fragments = (text: string): SubtitlesFragment[] => [{ text, start: 0, end: 1000 }]

function setup() {
  let videoId: string | null = "video-A"
  const fetcher = {
    fetch: vi.fn<() => Promise<SubtitlesFragment[]>>().mockResolvedValue(fragments("video A")),
    cleanup: vi.fn<() => void>(),
    shouldUseSameTrack: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    isPreSegmented: () => true,
  }
  const adapter = new UniversalVideoAdapter({
    config: {
      selectors: {
        video: "video",
        playerContainer: ".player",
        controlsBar: ".controls",
        nativeSubtitles: ".native-subtitles",
      },
      events: {},
      getVideoId: () => videoId,
    },
    fetchers: { native: () => fetcher },
  })
  return {
    adapter,
    fetcher,
    navigate: (next: string | null = "video-B") => {
      videoId = next
    },
  }
}

describe("video summary task lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requestVideoSummary).mockResolvedValue("summary")
    subtitlesStore.set(videoSummaryPartialAtom, "")
    vi.stubGlobal("document", { title: "Test video", querySelector: () => null })
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each(["video-B", null])("cancels first-load summaries when navigating to %s", async (next) => {
    const { adapter, fetcher, navigate } = setup()
    const fetched = deferred<SubtitlesFragment[]>()
    fetcher.fetch.mockReturnValue(fetched.promise)
    const pending = adapter.generateVideoSummary(DEFAULT_CONFIG).catch((error: unknown) => error)
    await vi.waitFor(() => expect(fetcher.fetch).toHaveBeenCalledTimes(1))

    navigate(next)
    expect(adapter.videoIdChanged).toBe(true)
    ;(adapter as any).handleNavigationStart()
    fetched.resolve(fragments("old video A"))

    expect(await pending).toMatchObject({ name: "AbortError" })
    expect(requestVideoSummary).not.toHaveBeenCalled()
    expect((adapter as any).sourceSubtitles).toEqual([])
    expect(subtitlesStore.get(videoSummaryPartialAtom)).toBe("")
  })

  it("discards a subtitle load after its source cache was cleared", async () => {
    const { adapter, fetcher } = setup()
    const fetched = deferred<SubtitlesFragment[]>()
    fetcher.fetch.mockReturnValue(fetched.promise)
    const pending = adapter.generateVideoSummary(DEFAULT_CONFIG).catch((error: unknown) => error)
    await vi.waitFor(() => expect(fetcher.fetch).toHaveBeenCalledTimes(1))
    ;(adapter as any).clearSourceCache()
    fetched.resolve(fragments("obsolete source track"))

    expect(await pending).toMatchObject({ name: "AbortError" })
    expect(requestVideoSummary).not.toHaveBeenCalled()
    expect((adapter as any).sourceSubtitles).toEqual([])
  })

  it("does not let an older subtitle load cancel or overwrite the newer summary", async () => {
    const { adapter, fetcher } = setup()
    const oldLoad = deferred<SubtitlesFragment[]>()
    fetcher.fetch.mockReturnValueOnce(oldLoad.promise).mockResolvedValueOnce(fragments("new load"))
    const stream = deferred<string>()
    vi.mocked(requestVideoSummary).mockReturnValue(stream.promise)
    const oldPending = adapter.generateVideoSummary(DEFAULT_CONFIG).catch((error: unknown) => error)
    await vi.waitFor(() => expect(fetcher.fetch).toHaveBeenCalledTimes(1))
    const newPending = adapter.generateVideoSummary(DEFAULT_CONFIG)
    await vi.waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(1))
    const options = vi.mocked(requestVideoSummary).mock.calls[0]![2]!

    oldLoad.resolve(fragments("old load"))
    expect(await oldPending).toMatchObject({ name: "AbortError" })
    expect(options.signal!.aborted).toBe(false)
    expect(requestVideoSummary).toHaveBeenCalledTimes(1)
    expect((adapter as any).sourceProcessedSubtitles).toEqual(fragments("new load"))
    stream.resolve("new summary")
    await expect(newPending).resolves.toBe("new summary")
  })

  it("ignores late chunks and completion from an aborted stream", async () => {
    const { adapter } = setup()
    const oldStream = deferred<string>()
    const newStream = deferred<string>()
    vi.mocked(requestVideoSummary)
      .mockReturnValueOnce(oldStream.promise)
      .mockReturnValueOnce(newStream.promise)
    const oldPending = adapter.generateVideoSummary(DEFAULT_CONFIG).catch((error: unknown) => error)
    await vi.waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(1))
    const oldOptions = vi.mocked(requestVideoSummary).mock.calls[0]![2]!
    const newPending = adapter.generateVideoSummary(DEFAULT_CONFIG)
    await vi.waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(2))
    const newOptions = vi.mocked(requestVideoSummary).mock.calls[1]![2]!

    newOptions.onChunk!("new partial")
    oldOptions.onChunk!("late old partial")
    expect(subtitlesStore.get(videoSummaryPartialAtom)).toBe("new partial")
    oldStream.resolve("old summary")
    expect(await oldPending).toMatchObject({ name: "AbortError" })
    expect(newOptions.signal!.aborted).toBe(false)
    newStream.resolve("new summary")
    await expect(newPending).resolves.toBe("new summary")
  })

  it("keeps one streaming query and its partial text across closing and reopening", async () => {
    const { adapter } = setup()
    const completion = deferred<string>()
    vi.mocked(requestVideoSummary).mockReturnValue(completion.promise)
    const client = new QueryClient()
    const options = {
      queryKey: ["subtitles", "video-summary", "video-A", "eng"],
      queryFn: () => adapter.generateVideoSummary(DEFAULT_CONFIG),
      retry: false,
      staleTime: Infinity,
      gcTime: Infinity,
    }
    const first = new QueryObserver(client, options)
    const close = first.subscribe(() => {})
    await vi.waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(1))
    const streamOptions = vi.mocked(requestVideoSummary).mock.calls[0]![2]!
    close()
    streamOptions.onChunk!("partial while closed")
    const reopened = new QueryObserver(client, options)
    const unsubscribe = reopened.subscribe(() => {})

    expect(streamOptions.signal!.aborted).toBe(false)
    expect(subtitlesStore.get(videoSummaryPartialAtom)).toBe("partial while closed")
    expect(requestVideoSummary).toHaveBeenCalledTimes(1)
    expect(vi.mocked(requestVideoSummary).mock.calls[0]![1]).toBe(DEFAULT_CONFIG)
    completion.resolve("complete summary")
    await vi.waitFor(() => expect(reopened.getCurrentResult().data).toBe("complete summary"))
    unsubscribe()
    client.clear()
  })
})
