// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { HOVER_PAUSE_DELAY_MS } from "@/utils/constants/subtitles"
import { subtitlesStore } from "../../atoms"
import { SubtitlesUIContext } from "../../ui/subtitles-ui-context"
import { subtitlesHoveredAtom, wordLookupAtom } from "../atoms"
import { useHoldPlayback } from "../use-hold-playback"

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  const { DEFAULT_CONFIG: defaults } = await import("@/utils/constants/config")
  return {
    configAtom: atom(defaults),
    configFieldsAtomMap: { videoSubtitles: atom(defaults.videoSubtitles) },
  }
})

function createVideo(initiallyPaused: boolean) {
  const video = document.createElement("video")
  let paused = initiallyPaused
  Object.defineProperty(video, "paused", { get: () => paused })
  const pause = vi.spyOn(video, "pause").mockImplementation(() => {
    paused = true
  })
  const play = vi.spyOn(video, "play").mockImplementation(async () => {
    paused = false
  })
  const pressPlay = () => {
    paused = false
    video.dispatchEvent(new Event("play"))
  }
  return { video, pause, play, pressPlay }
}

function renderHold(video: HTMLVideoElement) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={subtitlesStore}>
      <SubtitlesUIContext value={{ getVideoElement: () => video } as never}>
        {children}
      </SubtitlesUIContext>
    </Provider>
  )
  return renderHook(() => useHoldPlayback(), { wrapper })
}

function setPauseOnHover(pauseOnHover: boolean) {
  act(() => {
    void subtitlesStore.set(configFieldsAtomMap.videoSubtitles, {
      ...DEFAULT_CONFIG.videoSubtitles,
      pauseOnHover,
    })
  })
}

function hover(hovered: boolean) {
  act(() => subtitlesStore.set(subtitlesHoveredAtom, hovered))
}

function rest(ms = HOVER_PAUSE_DELAY_MS) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function lookUpWord(index: number | null) {
  act(() => subtitlesStore.set(wordLookupAtom, index === null ? null : { cueStart: 0, index }))
}

describe("useHoldPlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setPauseOnHover(true)
  })

  afterEach(() => {
    hover(false)
    lookUpWord(null)
    setPauseOnHover(false)
    vi.useRealTimers()
  })

  it("pauses once the pointer rests on the subtitles and plays once it leaves", () => {
    const { video, pause, play } = createVideo(false)
    renderHold(video)

    hover(true)
    rest(HOVER_PAUSE_DELAY_MS - 1)
    expect(pause).not.toHaveBeenCalled()

    rest(1)
    expect(pause).toHaveBeenCalledTimes(1)

    hover(false)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("leaves the video playing when the pointer only passes over the subtitles", () => {
    const { video, pause, play } = createVideo(false)
    renderHold(video)

    hover(true)
    rest(HOVER_PAUSE_DELAY_MS / 2)
    hover(false)
    rest()

    expect(pause).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it("does not pause on hover with pause-on-hover off", () => {
    setPauseOnHover(false)
    const { video, pause } = createVideo(false)
    renderHold(video)

    hover(true)
    rest()

    expect(pause).not.toHaveBeenCalled()
  })

  it("still pauses for a lookup with pause-on-hover off, and plays on close under the pointer", () => {
    setPauseOnHover(false)
    const { video, pause, play } = createVideo(false)
    renderHold(video)

    hover(true)
    lookUpWord(2)
    expect(pause).toHaveBeenCalledTimes(1)

    lookUpWord(null)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("stays paused after the pointer leaves while a lookup is open, then plays on close", () => {
    const { video, play } = createVideo(false)
    renderHold(video)

    hover(true)
    lookUpWord(2)
    hover(false)
    expect(play).not.toHaveBeenCalled()

    lookUpWord(null)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("leaves a video the viewer had paused alone", () => {
    const { video, pause, play } = createVideo(true)
    renderHold(video)

    hover(true)
    rest()
    lookUpWord(2)
    lookUpWord(null)
    hover(false)

    expect(pause).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it("does not play again when the viewer pressed play during the hold", () => {
    const { video, play, pressPlay } = createVideo(false)
    renderHold(video)

    lookUpWord(2)
    act(pressPlay)
    lookUpWord(null)

    expect(play).not.toHaveBeenCalled()
  })

  it("plays again when the subtitles go away mid-hold", () => {
    const { video, play } = createVideo(false)
    const { unmount } = renderHold(video)

    hover(true)
    rest()
    unmount()

    expect(play).toHaveBeenCalledTimes(1)
  })
})
