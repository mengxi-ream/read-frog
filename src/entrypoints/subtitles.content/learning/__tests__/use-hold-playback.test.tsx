// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { subtitlesStore } from "../../atoms"
import { SubtitlesUIContext } from "../../ui/subtitles-ui-context"
import { subtitlesHoveredAtom, wordLookupAtom } from "../atoms"
import { useHoldPlayback } from "../use-hold-playback"

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

function hover(hovered: boolean) {
  act(() => subtitlesStore.set(subtitlesHoveredAtom, hovered))
}

function lookUpWord(index: number | null) {
  act(() => subtitlesStore.set(wordLookupAtom, index === null ? null : { cueStart: 0, index }))
}

describe("useHoldPlayback", () => {
  afterEach(() => {
    hover(false)
    lookUpWord(null)
  })

  it("pauses while the pointer is on the subtitles and plays once it leaves", () => {
    const { video, pause, play } = createVideo(false)
    renderHold(video)

    hover(true)
    expect(pause).toHaveBeenCalledTimes(1)

    hover(false)
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
    unmount()

    expect(play).toHaveBeenCalledTimes(1)
  })
})
