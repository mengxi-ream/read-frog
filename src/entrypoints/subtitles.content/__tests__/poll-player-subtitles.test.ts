// @vitest-environment jsdom

import type { ContentScriptContext } from "#imports"
import type { PlatformConfig } from "../platforms"
import type { UniversalVideoAdapter } from "../universal-adapter"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PLAYER_WATCH_POLL_INTERVAL_MS } from "@/utils/constants/subtitles"
import { pollPlayerSubtitles } from "../poll-player-subtitles"

const calls = vi.hoisted(() => [] as string[])
vi.mock("../renderer/mount-subtitles-ui", () => ({
  mountSubtitlesUI: async () => {
    calls.push("mount")
  },
  unmountSubtitlesUI: () => {
    calls.push("unmount")
  },
}))
vi.mock("../renderer/mount-subtitles-sidebar", () => ({ mountSubtitlesSidebar: () => {} }))
vi.mock("../bind-subtitles-toggle-shortcut", () => ({
  bindSubtitlesToggleShortcut: async () => () => {},
}))

let videoId: string | null
let invalidated: Array<() => void>

function addPlayer(): HTMLElement {
  const player = document.createElement("div")
  player.className = "player"
  document.body.append(player)
  return player
}

function start() {
  const adapter = {
    initialize: vi.fn<() => Promise<void>>(async () => {
      calls.push("initialize")
    }),
    notifyNavigation: vi.fn<() => void>(() => {
      calls.push("navigate")
    }),
  }
  const config = {
    platform: "bilibili",
    selectors: { video: ".player video", playerContainer: ".player" },
    events: {},
    getVideoId: () => videoId,
  } satisfies PlatformConfig
  const ctx = { onInvalidated: (callback: () => void) => invalidated.push(callback) }
  pollPlayerSubtitles(ctx as unknown as ContentScriptContext, {
    adapter: adapter as unknown as UniversalVideoAdapter,
    config,
  })
  return adapter
}

async function tick() {
  await vi.advanceTimersByTimeAsync(PLAYER_WATCH_POLL_INTERVAL_MS)
}

beforeEach(() => {
  vi.useFakeTimers()
  calls.length = 0
  invalidated = []
  videoId = "video/1"
  document.body.innerHTML = ""
})

afterEach(() => {
  invalidated.forEach((callback) => callback())
  vi.useRealTimers()
})

describe("pollPlayerSubtitles", () => {
  it("waits for a player, then mounts and starts the adapter once", async () => {
    start()
    await tick()
    expect(calls).toEqual([])

    addPlayer()
    await tick()
    await tick()

    expect(calls).toEqual(["mount", "initialize"])
  })

  it("remounts before telling the adapter about a new video or a new player", async () => {
    const player = addPlayer()
    start()
    await tick()
    calls.length = 0

    videoId = "video/2"
    await tick()
    expect(calls).toEqual(["mount", "navigate"])

    calls.length = 0
    player.remove()
    addPlayer()
    await tick()
    expect(calls).toEqual(["mount", "navigate"])
  })

  it("cleans up when the page leaves the player, and comes back as a navigation", async () => {
    const player = addPlayer()
    start()
    await tick()
    calls.length = 0

    player.remove()
    await tick()
    await tick()

    expect(calls).toEqual(["unmount", "navigate"])

    calls.length = 0
    addPlayer()
    await tick()
    expect(calls).toEqual(["mount", "navigate"])
  })

  it("stops when the content script goes away", async () => {
    addPlayer()
    start()
    await tick()
    invalidated.forEach((callback) => callback())
    calls.length = 0

    videoId = "video/2"
    await tick()

    expect(calls).toEqual([])
  })
})
