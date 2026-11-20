// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://x.com/home" }
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initXcomSubtitles } from "../init-xcom-subtitles"

const mocks = vi.hoisted(() => ({
  primaryVideo: null as HTMLVideoElement | null,
  onPlayerChanged: () => {},
  ensureEntryPoint: vi.fn<(container: HTMLElement | null) => boolean>((container) => !!container),
  adapter: {
    initialize: vi.fn<() => Promise<void>>(async () => {}),
    notifyNavigation: vi.fn<() => void>(),
    isAwaitingAiSubtitles: vi.fn<() => boolean>(() => false),
  },
}))

vi.mock("../platforms/xcom", () => ({ createXcomSubtitlesAdapter: () => mocks.adapter }))
vi.mock("../platforms/xcom/config", () => ({ getXcomConfig: () => ({}) }))
vi.mock("../platforms/xcom/dom", () => ({
  getCurrentPrimaryXcomStatusVideo: () => mocks.primaryVideo,
  getCurrentXcomVideoId: () => mocks.primaryVideo?.dataset.statusId ?? null,
  getXcomStatusVideoContainer: (video: HTMLVideoElement) => video.parentElement,
}))
vi.mock("../platforms/xcom/overlay-entry", () => ({
  clearXcomOverlayEntryPoints: vi.fn<() => void>(),
  ensureXcomOverlayEntryPoint: mocks.ensureEntryPoint,
  mountXcomTranslateButton: vi.fn<() => void>(),
}))
vi.mock("../platforms/xcom/watch-player", () => ({
  watchXcomPlayer: (onChanged: () => void) => {
    mocks.onPlayerChanged = onChanged
    return () => {}
  },
}))
vi.mock("../renderer/mount-subtitles-ui", () => ({
  mountSubtitlesUI: vi.fn<() => Promise<void>>(async () => {}),
  unmountSubtitlesUI: vi.fn<() => void>(),
}))
vi.mock("../renderer/mount-subtitles-sidebar", () => ({
  mountSubtitlesSidebar: vi.fn<() => void>(),
}))
vi.mock("../bind-subtitles-toggle-shortcut", () => ({
  bindSubtitlesToggleShortcut: vi.fn<() => Promise<() => void>>(async () => () => {}),
}))

function addPlayer(statusId: string): { container: HTMLElement; video: HTMLVideoElement } {
  const container = document.createElement("div")
  const video = document.createElement("video")
  video.dataset.statusId = statusId
  container.append(video)
  document.body.append(container)
  return { container, video }
}

const invalidations: Array<() => void> = []

async function startOn(video: HTMLVideoElement) {
  mocks.primaryVideo = video
  initXcomSubtitles({ onInvalidated: (stop: () => void) => invalidations.push(stop) } as never)
  await vi.waitFor(() => expect(mocks.adapter.initialize).toHaveBeenCalled())
}

describe("initXcomSubtitles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.adapter.isAwaitingAiSubtitles.mockReturnValue(false)
  })

  afterEach(() => {
    for (const stop of invalidations.splice(0)) {
      stop()
    }
    document.body.replaceChildren()
  })

  it("keeps the player whose AI subtitles are loading when the pointer passes over another video", async () => {
    const first = addPlayer("1")
    const second = addPlayer("2")
    await startOn(first.video)

    mocks.adapter.isAwaitingAiSubtitles.mockReturnValue(true)
    mocks.primaryVideo = second.video
    mocks.onPlayerChanged()

    expect(mocks.ensureEntryPoint).toHaveBeenLastCalledWith(first.container)
    expect(mocks.adapter.notifyNavigation).not.toHaveBeenCalled()

    mocks.adapter.isAwaitingAiSubtitles.mockReturnValue(false)
    mocks.onPlayerChanged()

    expect(mocks.ensureEntryPoint).toHaveBeenLastCalledWith(second.container)
    await vi.waitFor(() => expect(mocks.adapter.notifyNavigation).toHaveBeenCalledOnce())
  })

  it("lets go of that player once it leaves the page", async () => {
    const first = addPlayer("1")
    const second = addPlayer("2")
    await startOn(first.video)

    mocks.adapter.isAwaitingAiSubtitles.mockReturnValue(true)
    first.container.remove()
    mocks.primaryVideo = second.video
    mocks.onPlayerChanged()

    expect(mocks.ensureEntryPoint).toHaveBeenLastCalledWith(second.container)
    await vi.waitFor(() => expect(mocks.adapter.notifyNavigation).toHaveBeenCalledOnce())
  })
})
