// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.netflix.com/watch/81000001" }

import type { MockInstance } from "vitest"
import type { ContentScriptContext } from "#imports"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toastManager } from "@/components/ui/base-ui/toast"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  NAVIGATION_HANDLER_DELAY,
  NETFLIX_WATCH_POLL_INTERVAL_MS,
} from "@/utils/constants/subtitles"
import { initNetflixSubtitles } from "../init-netflix-subtitles"
import { UniversalVideoAdapter } from "../universal-adapter"

// The real Netflix watcher and adapter; only the UI, the shortcut and the config read are stubbed.
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
  // Netflix is on "manual" here, as by default: nothing starts subtitles on its own.
  getLocalConfig: async () => DEFAULT_CONFIG,
}))

// How long the adapter waits for the video after a navigation before it reports it missing.
const VIDEO_LOOKUP_TIMEOUT_MS = 10_000

const invalidations: Array<() => void> = []

function addPlayer(): { player: HTMLElement; video: HTMLVideoElement } {
  const player = document.createElement("div")
  player.dataset.uia = "player"
  const video = document.createElement("video")
  player.append(video)
  document.body.append(player)
  return { player, video }
}

async function startOn(video: HTMLVideoElement): Promise<UniversalVideoAdapter> {
  const initialize = vi.spyOn(UniversalVideoAdapter.prototype, "initialize")
  initNetflixSubtitles({
    onInvalidated: (callback: () => void) => invalidations.push(callback),
  } as unknown as ContentScriptContext)
  await vi.waitFor(() => expect(initialize).toHaveBeenCalledOnce())
  const adapter = initialize.mock.contexts[0] as UniversalVideoAdapter
  await vi.waitFor(() => expect(adapter.getVideoElement()).toBe(video))
  return adapter
}

function backToBrowse(player: HTMLElement) {
  window.history.pushState({}, "", "/browse")
  player.remove()
}

describe("Netflix leaving the player", () => {
  let notifyLeave: MockInstance<UniversalVideoAdapter["notifyLeave"]>
  let notifyNavigation: MockInstance<UniversalVideoAdapter["notifyNavigation"]>

  beforeEach(() => {
    vi.useFakeTimers()
    window.history.replaceState({}, "", "/watch/81000001")
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

  it("says nothing when the viewer goes back to browsing", async () => {
    const { player, video } = addPlayer()
    await startOn(video)

    backToBrowse(player)
    await vi.advanceTimersByTimeAsync(
      NETFLIX_WATCH_POLL_INTERVAL_MS + NAVIGATION_HANDLER_DELAY + VIDEO_LOOKUP_TIMEOUT_MS,
    )

    expect(toastManager.add).not.toHaveBeenCalled()
    // A navigation would have waited for a video that is not coming and reported it missing.
    expect(notifyLeave).toHaveBeenCalledOnce()
    expect(notifyNavigation).not.toHaveBeenCalled()
  })

  it("follows the next title the viewer plays", async () => {
    const first = addPlayer()
    const adapter = await startOn(first.video)

    backToBrowse(first.player)
    await vi.advanceTimersByTimeAsync(NETFLIX_WATCH_POLL_INTERVAL_MS)
    expect(adapter.getVideoElement()).toBeNull()

    window.history.pushState({}, "", "/watch/81000002")
    const next = addPlayer()
    await vi.advanceTimersByTimeAsync(NETFLIX_WATCH_POLL_INTERVAL_MS + NAVIGATION_HANDLER_DELAY)

    expect(adapter.getVideoElement()).toBe(next.video)
    expect(toastManager.add).not.toHaveBeenCalled()
  })
})
