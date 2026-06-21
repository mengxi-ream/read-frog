// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { XCOM_CONTROLS_CONTAINER_SELECTOR, XCOM_PLAYER_CONTAINER_SELECTOR } from "@/utils/constants/subtitles"
import { initXcomSubtitles } from "../init-xcom-subtitles"

const mocks = vi.hoisted(() => ({
  createXcomSubtitlesAdapter: vi.fn(),
  mountSubtitlesUI: vi.fn(),
  unmountSubtitlesUI: vi.fn(),
}))

vi.mock("../platforms/xcom", () => ({
  createXcomSubtitlesAdapter: mocks.createXcomSubtitlesAdapter,
}))

vi.mock("../renderer/mount-subtitles-ui", () => ({
  mountSubtitlesUI: mocks.mountSubtitlesUI,
  unmountSubtitlesUI: mocks.unmountSubtitlesUI,
}))

function createAdapterMock() {
  return {
    cleanupForRouteExit: vi.fn(),
    handleSourceTrackChanged: vi.fn(),
    initialize: vi.fn(),
    notifyNavigation: vi.fn(),
  }
}

function setLocation(href: string) {
  const url = new URL(href)
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      href,
      hostname: url.hostname,
    },
  })
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

function renderStatusPage(statusId: string) {
  document.body.innerHTML = [
    `<article><a href="https://x.com/user/status/${statusId}">status</a>`,
    `<div id="status-${statusId}" data-testid="videoPlayer"><video></video></div></article>`,
  ].join("")
}

describe("initXcomSubtitles", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.createXcomSubtitlesAdapter.mockReset()
    mocks.mountSubtitlesUI.mockReset()
    mocks.mountSubtitlesUI.mockResolvedValue(undefined)
    mocks.unmountSubtitlesUI.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("forces a rebind when navigating from one status video to another before subtitles start", async () => {
    const adapter = createAdapterMock()
    mocks.createXcomSubtitlesAdapter.mockReturnValue(adapter)
    setLocation("https://x.com/user/status/111")
    renderStatusPage("111")

    initXcomSubtitles()
    await flushAsyncWork()

    expect(adapter.initialize).toHaveBeenCalledTimes(1)
    expect(document.querySelector("#status-111")?.matches(XCOM_PLAYER_CONTAINER_SELECTOR)).toBe(true)

    setLocation("https://x.com/user/status/222")
    document.body.innerHTML = [
      "<article><a href=\"https://x.com/user/status/111\">old</a><div id=\"status-111\" data-testid=\"videoPlayer\"><video></video></div></article>",
      "<article><a href=\"https://x.com/user/status/222\">new</a><div id=\"status-222\" data-testid=\"videoPlayer\"><video></video></div></article>",
    ].join("")

    await vi.advanceTimersByTimeAsync(500)
    await flushAsyncWork()

    expect(adapter.notifyNavigation).toHaveBeenCalledWith({ force: true })
    expect(document.querySelector("#status-222")?.matches(XCOM_PLAYER_CONTAINER_SELECTOR)).toBe(true)
    expect(document.querySelector("#status-111")?.matches(XCOM_PLAYER_CONTAINER_SELECTOR)).toBe(false)
  })

  it("forces a rebind when the same status opens the media viewer video route", async () => {
    const adapter = createAdapterMock()
    mocks.createXcomSubtitlesAdapter.mockReturnValue(adapter)
    setLocation("https://x.com/user/status/111")
    renderStatusPage("111")

    initXcomSubtitles()
    await flushAsyncWork()

    setLocation("https://x.com/user/status/111/video/1")
    document.body.innerHTML = [
      "<article><a href=\"https://x.com/user/status/111\">status</a><div id=\"status-111\" data-testid=\"videoPlayer\"><video></video></div></article>",
      "<div role=\"dialog\" aria-modal=\"true\"><div id=\"viewer\" data-testid=\"videoPlayer\"><video></video></div></div>",
    ].join("")

    await vi.advanceTimersByTimeAsync(500)
    await flushAsyncWork()

    expect(adapter.notifyNavigation).toHaveBeenCalledWith({ force: true })
    expect(document.querySelector("#viewer")?.matches(XCOM_PLAYER_CONTAINER_SELECTOR)).toBe(true)
    expect(document.querySelector("#status-111")?.matches(XCOM_PLAYER_CONTAINER_SELECTOR)).toBe(false)
  })

  it("cleans x.com subtitle UI state when leaving status routes", async () => {
    const adapter = createAdapterMock()
    mocks.createXcomSubtitlesAdapter.mockReturnValue(adapter)
    setLocation("https://x.com/user/status/111")
    renderStatusPage("111")

    initXcomSubtitles()
    await flushAsyncWork()

    expect(document.querySelector(XCOM_CONTROLS_CONTAINER_SELECTOR)).not.toBeNull()

    setLocation("https://x.com/home")
    await vi.advanceTimersByTimeAsync(500)
    await flushAsyncWork()

    expect(adapter.cleanupForRouteExit).toHaveBeenCalledTimes(1)
    expect(document.querySelector(XCOM_PLAYER_CONTAINER_SELECTOR)).toBeNull()
    expect(document.querySelector(XCOM_CONTROLS_CONTAINER_SELECTOR)).toBeNull()
  })

  it("cleans stale x.com subtitle UI when the next status has no eligible video yet", async () => {
    const adapter = createAdapterMock()
    mocks.createXcomSubtitlesAdapter.mockReturnValue(adapter)
    setLocation("https://x.com/user/status/111")
    renderStatusPage("111")

    initXcomSubtitles()
    await flushAsyncWork()

    expect(document.querySelector("#status-111")?.matches(XCOM_PLAYER_CONTAINER_SELECTOR)).toBe(true)
    expect(document.querySelector(XCOM_CONTROLS_CONTAINER_SELECTOR)).not.toBeNull()

    setLocation("https://x.com/user/status/222")
    await vi.advanceTimersByTimeAsync(500)
    await flushAsyncWork()

    expect(adapter.cleanupForRouteExit).toHaveBeenCalledTimes(1)
    expect(document.querySelector("#status-111")?.matches(XCOM_PLAYER_CONTAINER_SELECTOR)).toBe(false)
    expect(document.querySelector(XCOM_CONTROLS_CONTAINER_SELECTOR)).toBeNull()
  })

  it("refreshes the active source track when x.com shows a new native text track", async () => {
    const adapter = createAdapterMock()
    mocks.createXcomSubtitlesAdapter.mockReturnValue(adapter)
    setLocation("https://x.com/user/status/111")
    renderStatusPage("111")

    const video = document.querySelector("video") as HTMLVideoElement
    const englishTrack = {
      label: "English",
      language: "en",
      mode: "hidden",
    }
    const spanishTrack = {
      label: "Spanish",
      language: "es",
      mode: "hidden",
    }
    Object.defineProperty(video, "textTracks", {
      value: [englishTrack, spanishTrack],
      configurable: true,
    })

    initXcomSubtitles()
    await flushAsyncWork()

    spanishTrack.mode = "showing"
    await vi.advanceTimersByTimeAsync(500)
    await flushAsyncWork()

    expect(adapter.handleSourceTrackChanged).toHaveBeenCalledTimes(1)
  })

  it("refreshes the marked x.com video track when primary video selection is ambiguous", async () => {
    const adapter = createAdapterMock()
    mocks.createXcomSubtitlesAdapter.mockReturnValue(adapter)
    setLocation("https://x.com/user/status/111")
    renderStatusPage("111")

    initXcomSubtitles()
    await flushAsyncWork()

    const markedVideo = document.querySelector(`${XCOM_PLAYER_CONTAINER_SELECTOR} video`) as HTMLVideoElement
    const spanishTrack = {
      label: "Spanish",
      language: "es",
      mode: "hidden",
    }
    Object.defineProperty(markedVideo, "textTracks", {
      value: [spanishTrack],
      configurable: true,
    })

    document.body.insertAdjacentHTML(
      "beforeend",
      "<article><a href=\"https://x.com/user/status/111\">duplicate</a><div id=\"status-111-duplicate\" data-testid=\"videoPlayer\"><video></video></div></article>",
    )

    spanishTrack.mode = "showing"
    await vi.advanceTimersByTimeAsync(500)
    await flushAsyncWork()

    expect(adapter.handleSourceTrackChanged).toHaveBeenCalledTimes(1)
  })
})
