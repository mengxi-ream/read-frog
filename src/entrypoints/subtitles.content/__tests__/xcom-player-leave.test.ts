// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://x.com/home" }

import type { MockInstance } from "vitest"
import type { ContentScriptContext } from "#imports"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toastManager } from "@/components/ui/base-ui/toast"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { NAVIGATION_HANDLER_DELAY, XCOM_STATUS_POLL_INTERVAL_MS } from "@/utils/constants/subtitles"
import { initXcomSubtitles } from "../init-xcom-subtitles"
import { UniversalVideoAdapter } from "../universal-adapter"

// The real X watcher and adapter; only the UI, the shortcut and the config read are stubbed.
vi.mock("../renderer/mount-subtitles-ui", () => ({
  mountSubtitlesUI: async () => {},
  unmountSubtitlesUI: () => {},
}))
vi.mock("../renderer/mount-subtitles-sidebar", () => ({ mountSubtitlesSidebar: () => {} }))
vi.mock("../bind-subtitles-toggle-shortcut", () => ({
  bindSubtitlesToggleShortcut: async () => () => {},
}))
vi.mock("@/utils/config/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/config/storage")>()),
  // X is on "manual" here, as by default: nothing starts subtitles on its own.
  getLocalConfig: async () => DEFAULT_CONFIG,
}))

// How long the adapter waits for the video after a navigation before it reports it missing.
const VIDEO_LOOKUP_TIMEOUT_MS = 10_000

const invalidations: Array<() => void> = []

function addVideoPost(statusId: string): { post: HTMLElement; video: HTMLVideoElement } {
  const post = document.createElement("article")
  post.innerHTML = `<a href="/someone/status/${statusId}">post</a><div data-testid="videoComponent"><div data-testid="videoPlayer"><video></video></div></div>`
  document.body.append(post)
  return { post, video: post.querySelector("video")! }
}

async function startOn(video: HTMLVideoElement): Promise<UniversalVideoAdapter> {
  const initialize = vi.spyOn(UniversalVideoAdapter.prototype, "initialize")
  initXcomSubtitles({
    onInvalidated: (callback: () => void) => invalidations.push(callback),
  } as unknown as ContentScriptContext)
  await vi.waitFor(() => expect(initialize).toHaveBeenCalledOnce())
  const adapter = initialize.mock.contexts[0] as UniversalVideoAdapter
  await vi.waitFor(() => expect(adapter.getVideoElement()).toBe(video))
  return adapter
}

describe("x.com timeline leaving the video it followed", () => {
  let notifyLeave: MockInstance<UniversalVideoAdapter["notifyLeave"]>
  let notifyNavigation: MockInstance<UniversalVideoAdapter["notifyNavigation"]>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(toastManager, "add")
    notifyLeave = vi.spyOn(UniversalVideoAdapter.prototype, "notifyLeave")
    notifyNavigation = vi.spyOn(UniversalVideoAdapter.prototype, "notifyNavigation")
  })

  afterEach(() => {
    for (const stop of invalidations.splice(0)) stop()
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("says nothing when the video scrolls out of the page and none takes its place", async () => {
    const { post, video } = addVideoPost("1001")
    await startOn(video)

    post.remove()
    await vi.advanceTimersByTimeAsync(
      XCOM_STATUS_POLL_INTERVAL_MS + NAVIGATION_HANDLER_DELAY + VIDEO_LOOKUP_TIMEOUT_MS,
    )

    expect(toastManager.add).not.toHaveBeenCalled()
    // A navigation would have waited for a video that is not coming and reported it missing.
    expect(notifyLeave).toHaveBeenCalledOnce()
    expect(notifyNavigation).not.toHaveBeenCalled()
  })

  it("follows the next video the timeline brings in", async () => {
    const first = addVideoPost("1001")
    const adapter = await startOn(first.video)

    first.post.remove()
    await vi.advanceTimersByTimeAsync(XCOM_STATUS_POLL_INTERVAL_MS)
    expect(adapter.getVideoElement()).toBeNull()

    const next = addVideoPost("2001")
    await vi.advanceTimersByTimeAsync(XCOM_STATUS_POLL_INTERVAL_MS + NAVIGATION_HANDLER_DELAY)

    expect(adapter.getVideoElement()).toBe(next.video)
    expect(toastManager.add).not.toHaveBeenCalled()
  })
})
