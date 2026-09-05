// @vitest-environment jsdom
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { showAnchoredSubtitlesToast } from "@/utils/subtitles/toast"
import { checkVideoSummaryAvailability, requestVideoSummary } from "@/utils/subtitles/video-summary"
import { queryClient } from "@/utils/tanstack-query"
import {
  currentVideoIdAtom,
  subtitlesSidebarOpenAtom,
  subtitlesStore,
  videoSummaryPartialAtom,
} from "../atoms"
import { SubtitlesSidebarItem } from "../ui/subtitles-settings-panel/components/subtitles-sidebar-item"
import { SubtitlesSidebar } from "../ui/subtitles-sidebar"
import { SummarySection } from "../ui/subtitles-sidebar/sections/summary"
import { UniversalVideoAdapter } from "../universal-adapter"

vi.mock("@/utils/subtitles/video-summary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/subtitles/video-summary")>()),
  checkVideoSummaryAvailability: vi.fn<typeof checkVideoSummaryAvailability>(),
  requestVideoSummary: vi.fn<typeof requestVideoSummary>(),
}))
vi.mock("@/utils/subtitles/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/subtitles/toast")>()),
  showAnchoredSubtitlesToast: vi.fn<typeof showAnchoredSubtitlesToast>(),
}))
vi.mock("@/utils/config/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/config/storage")>()),
  getLocalConfig: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}))

// Exercise the real sidebar visibility, query and adapter, without the tab bar's layout.
vi.mock("../ui/subtitles-sidebar/sidebar-shell", () => ({ SidebarShell: () => <SummarySection /> }))
vi.mock("../ui/subtitles-ui-context", () => ({
  useSubtitlesUI: () => ({
    supportsSidebar: true,
    generateVideoSummary: adapter.generateVideoSummary,
    hasSubtitlesAvailable: adapter.hasSubtitlesAvailable,
  }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const fragments = (text: string): SubtitlesFragment[] => [{ text, start: 0, end: 1000 }]
let videoId: string | null
let adapter: UniversalVideoAdapter
function createFetcher() {
  const sourceVideoId = videoId!
  return {
    fetch: vi.fn<() => Promise<SubtitlesFragment[]>>().mockResolvedValue(fragments(sourceVideoId)),
    cleanup: vi.fn<() => void>(),
    shouldUseSameTrack: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    isPreSegmented: () => true,
  }
}
let fetchers: ReturnType<typeof createFetcher>[]

function renderPanel(open = true) {
  subtitlesStore.set(subtitlesSidebarOpenAtom, open)
  return render(
    <Provider store={subtitlesStore}>
      <QueryClientProvider client={queryClient}>
        <SubtitlesSidebarItem />
        <SubtitlesSidebar />
      </QueryClientProvider>
    </Provider>,
  )
}

function startNavigation(next: string | null) {
  act(() => {
    videoId = next
    ;(adapter as any).handleNavigationStart()
  })
}

async function finishNavigation() {
  await act(async () => {
    await (adapter as any).handleNavigation()
  })
}

function clickOpen() {
  fireEvent.click(screen.getByRole("button", { name: "subtitles.sidebar.menu.label" }))
}

describe("summary panel navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
    videoId = "A"
    fetchers = []
    subtitlesStore.set(currentVideoIdAtom, videoId)
    subtitlesStore.set(videoSummaryPartialAtom, "")
    subtitlesStore.set(subtitlesSidebarOpenAtom, false)
    vi.mocked(checkVideoSummaryAvailability).mockResolvedValue({ status: "ok" })
    vi.mocked(requestVideoSummary).mockImplementation(
      async (source) => `${source[0]!.text} summary`,
    )
    adapter = new UniversalVideoAdapter({
      config: {
        selectors: { video: "video", playerContainer: ".player", nativeSubtitles: ".captions" },
        events: {},
        getVideoId: () => videoId,
      },
      fetchers: {
        native: () => {
          const fetcher = createFetcher()
          fetchers.push(fetcher)
          return fetcher
        },
      },
    })
    vi.spyOn(adapter as any, "initializeScheduler").mockResolvedValue(undefined)
    vi.spyOn(adapter as any, "renderTranslateButton").mockResolvedValue(undefined)
    vi.spyOn(adapter as any, "tryAutoStartSubtitles").mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    ;(adapter as any).cancelVideoSummary()
    queryClient.clear()
    vi.restoreAllMocks()
  })

  it.each(["success", "error"])("starts B without waiting for A's late %s", async (completion) => {
    const old = deferred<string>()
    const next = deferred<string>()
    vi.mocked(requestVideoSummary)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise)
    renderPanel()
    await waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(1))
    const oldOptions = vi.mocked(requestVideoSummary).mock.calls[0]![2]!
    act(() => oldOptions.onChunk!("A partial"))
    expect(await screen.findByText("A partial")).toBeInTheDocument()

    startNavigation("B")
    expect(oldOptions.signal!.aborted).toBe(true)
    expect(subtitlesStore.get(currentVideoIdAtom)).toBeNull()
    expect(screen.queryByText("A partial")).not.toBeInTheDocument()
    await finishNavigation()
    await waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(2))
    expect(subtitlesStore.get(subtitlesSidebarOpenAtom)).toBe(true)
    expect(vi.mocked(requestVideoSummary).mock.calls[1]![0]).toEqual(fragments("B"))
    const nextOptions = vi.mocked(requestVideoSummary).mock.calls[1]![2]!
    act(() => nextOptions.onChunk!("B partial"))
    expect(await screen.findByText("B partial")).toBeInTheDocument()

    await act(async () => {
      oldOptions.onChunk!("late A partial")
      if (completion === "success") old.resolve("late A result")
      else old.reject(new Error("late A failure"))
    })
    expect(nextOptions.signal!.aborted).toBe(false)
    expect(screen.getByText("B partial")).toBeInTheDocument()
    expect(screen.queryByText(/late A/)).not.toBeInTheDocument()
    expect(screen.queryByText("subtitles.sidebar.summary.failedTitle")).not.toBeInTheDocument()
    await act(async () => next.resolve("B complete"))
    expect(await screen.findByText("B complete")).toBeInTheDocument()
  })

  it("starts B while A's subtitle fetch is still pending", async () => {
    const oldLoad = deferred<SubtitlesFragment[]>()
    fetchers[0]!.fetch.mockReturnValue(oldLoad.promise)
    renderPanel()
    await waitFor(() => expect(fetchers[0]!.fetch).toHaveBeenCalledOnce())
    startNavigation("B")
    await finishNavigation()
    expect(await screen.findByText("B summary")).toBeInTheDocument()
    expect(fetchers).toHaveLength(2)
    await act(async () => oldLoad.resolve(fragments("old A")))
    expect(requestVideoSummary).toHaveBeenCalledOnce()
    expect(screen.getByText("B summary")).toBeInTheDocument()
  })

  it("follows completed summaries and stops following after the panel is closed", async () => {
    renderPanel()
    expect(await screen.findByText("A summary")).toBeInTheDocument()
    startNavigation("B")
    expect(screen.queryByText("A summary")).not.toBeInTheDocument()
    await finishNavigation()
    expect(await screen.findByText("B summary")).toBeInTheDocument()
    clickOpen() // Close the open panel.
    startNavigation("C")
    await finishNavigation()
    expect(requestVideoSummary).toHaveBeenCalledTimes(2)
    expect(subtitlesStore.get(subtitlesSidebarOpenAtom)).toBe(false)
  })

  it("skips intermediate videos during rapid A -> B -> C navigation", async () => {
    renderPanel()
    expect(await screen.findByText("A summary")).toBeInTheDocument()
    startNavigation("B")
    startNavigation("C")
    await finishNavigation()
    expect(await screen.findByText("C summary")).toBeInTheDocument()
    expect(vi.mocked(requestVideoSummary).mock.calls.map(([source]) => source[0]!.text)).toEqual([
      "A",
      "C",
    ])
  })

  it("recovers when navigation returns to A before B was published", async () => {
    const old = deferred<string>()
    vi.mocked(requestVideoSummary).mockReturnValueOnce(old.promise)
    renderPanel()
    await waitFor(() => expect(requestVideoSummary).toHaveBeenCalledOnce())
    startNavigation("B")
    startNavigation("A")
    await finishNavigation()
    expect(await screen.findByText("A summary")).toBeInTheDocument()
    expect(subtitlesStore.get(currentVideoIdAtom)).toBe("A")
    await act(async () => old.resolve("stale A"))
    expect(screen.queryByText("stale A")).not.toBeInTheDocument()
  })

  it("rejects an old query invocation without canceling B", async () => {
    startNavigation("B")
    await finishNavigation()
    const next = deferred<string>()
    vi.mocked(requestVideoSummary).mockReturnValue(next.promise)
    renderPanel()
    await waitFor(() => expect(requestVideoSummary).toHaveBeenCalledOnce())
    const options = vi.mocked(requestVideoSummary).mock.calls[0]![2]!
    await expect(adapter.generateVideoSummary(DEFAULT_CONFIG, "A")).rejects.toMatchObject({
      name: "AbortError",
    })
    expect(options.signal!.aborted).toBe(false)
    await act(async () => next.resolve("B complete"))
    expect(await screen.findByText("B complete")).toBeInTheDocument()
  })

  it("does not start a summary when leaving the video page", async () => {
    renderPanel()
    expect(await screen.findByText("A summary")).toBeInTheDocument()
    startNavigation(null)
    await finishNavigation()
    expect(requestVideoSummary).toHaveBeenCalledOnce()
    expect(screen.queryByText("A summary")).not.toBeInTheDocument()
  })

  it.each(["model", "subtitles"])(
    "discards the pending %s check after navigation",
    async (stage) => {
      const modelCheck = deferred<Awaited<ReturnType<typeof checkVideoSummaryAvailability>>>()
      const subtitlesCheck = deferred<boolean>()
      if (stage === "model")
        vi.mocked(checkVideoSummaryAvailability).mockReturnValueOnce(modelCheck.promise)
      else fetchers[0]!.hasAvailableSubtitles.mockReturnValueOnce(subtitlesCheck.promise)
      renderPanel(false)
      clickOpen()
      const check =
        stage === "subtitles" ? fetchers[0]!.hasAvailableSubtitles : checkVideoSummaryAvailability
      await waitFor(() => expect(check).toHaveBeenCalledOnce())
      startNavigation("B")
      await finishNavigation()
      await act(async () => {
        modelCheck.resolve({ status: "ok" })
        subtitlesCheck.resolve(true)
      })
      expect(subtitlesStore.get(subtitlesSidebarOpenAtom)).toBe(false)
      expect(requestVideoSummary).not.toHaveBeenCalled()
      expect(showAnchoredSubtitlesToast).not.toHaveBeenCalled()
      clickOpen()
      expect(await screen.findByText("B summary")).toBeInTheDocument()
    },
  )

  it("invalidates a pending open even when A -> null -> A is batched", async () => {
    const oldCheck = deferred<Awaited<ReturnType<typeof checkVideoSummaryAvailability>>>()
    vi.mocked(checkVideoSummaryAvailability).mockReturnValueOnce(oldCheck.promise)
    renderPanel(false)
    clickOpen()
    await act(async () => {
      videoId = "B"
      ;(adapter as any).handleNavigationStart()
      videoId = "A"
      await (adapter as any).handleNavigation()
      oldCheck.resolve({ status: "ok" })
    })
    expect(subtitlesStore.get(subtitlesSidebarOpenAtom)).toBe(false)
    expect(requestVideoSummary).not.toHaveBeenCalled()
  })

  it("keeps only C's stream active after A -> B -> C", async () => {
    const streams = [deferred<string>(), deferred<string>(), deferred<string>()]
    for (const stream of streams) vi.mocked(requestVideoSummary).mockReturnValueOnce(stream.promise)
    renderPanel()
    await waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(1))
    startNavigation("B")
    await finishNavigation()
    await waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(2))
    startNavigation("C")
    await finishNavigation()
    await waitFor(() => expect(requestVideoSummary).toHaveBeenCalledTimes(3))
    const options = vi
      .mocked(requestVideoSummary)
      .mock.calls.map(([, , streamOptions]) => streamOptions!)
    await act(async () => {
      options[2]!.onChunk!("C partial")
      options[1]!.onChunk!("late B")
      streams[1]!.resolve("B complete")
      streams[0]!.reject(new Error("late A error"))
    })
    expect(options.map(({ signal }) => signal!.aborted)).toEqual([true, true, false])
    expect(await screen.findByText("C partial")).toBeInTheDocument()
    expect(screen.queryByText(/late B|B complete|failedTitle/)).not.toBeInTheDocument()
    await act(async () => streams[2]!.resolve("C complete"))
    expect(await screen.findByText("C complete")).toBeInTheDocument()
  })

  it("keeps the current stream when closing and reopening on the same video", async () => {
    const stream = deferred<string>()
    vi.mocked(requestVideoSummary).mockReturnValueOnce(stream.promise)
    renderPanel()
    await waitFor(() => expect(requestVideoSummary).toHaveBeenCalledOnce())
    const options = vi.mocked(requestVideoSummary).mock.calls[0]![2]!
    clickOpen()
    act(() => options.onChunk!("A partial while closed"))
    clickOpen()
    expect(await screen.findByText("A partial while closed")).toBeInTheDocument()
    expect(options.signal!.aborted).toBe(false)
    expect(requestVideoSummary).toHaveBeenCalledOnce()
    await act(async () => stream.resolve("A complete"))
    expect(await screen.findByText("A complete")).toBeInTheDocument()
  })

  it("ignores an opening check after its control unmounts", async () => {
    const check = deferred<Awaited<ReturnType<typeof checkVideoSummaryAvailability>>>()
    vi.mocked(checkVideoSummaryAvailability).mockReturnValueOnce(check.promise)
    const view = renderPanel(false)
    clickOpen()
    view.unmount()
    await act(async () => check.resolve({ status: "ok" }))
    expect(subtitlesStore.get(subtitlesSidebarOpenAtom)).toBe(false)
    expect(requestVideoSummary).not.toHaveBeenCalled()
  })

  it.each(["blocked", "rejected"])(
    "ignores a stale %s check without clearing the new loading state",
    async (outcome) => {
      const oldCheck = deferred<Awaited<ReturnType<typeof checkVideoSummaryAvailability>>>()
      const nextCheck = deferred<Awaited<ReturnType<typeof checkVideoSummaryAvailability>>>()
      vi.mocked(checkVideoSummaryAvailability)
        .mockReturnValueOnce(oldCheck.promise)
        .mockReturnValueOnce(nextCheck.promise)
      renderPanel(false)
      clickOpen()
      startNavigation("B")
      await finishNavigation()
      clickOpen()
      await act(async () => {
        if (outcome === "blocked") oldCheck.resolve({ status: "needsModel" })
        else oldCheck.reject(new Error("old check failed"))
      })
      expect(
        screen
          .getByRole("button", { name: "subtitles.sidebar.menu.label" })
          .querySelector(".animate-spin"),
      ).not.toBeNull()
      expect(showAnchoredSubtitlesToast).not.toHaveBeenCalled()
      expect(subtitlesStore.get(subtitlesSidebarOpenAtom)).toBe(false)
      await act(async () => nextCheck.resolve({ status: "ok" }))
      expect(await screen.findByText("B summary")).toBeInTheDocument()
    },
  )
})
