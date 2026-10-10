// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subtitlesStore } from "../../atoms"
import { SubtitlesUIContext } from "../../ui/subtitles-ui-context"
import { closeWordLookupAtom, wordLookupAtom } from "../atoms"
import { useLookupPlayback } from "../use-lookup-playback"

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

function setOpen(open: boolean) {
  act(() => {
    subtitlesStore.set(
      wordLookupAtom,
      open ? { cueStart: 0, tokenIndex: 0, anchor: { x: 0, y: 0 } } : null,
    )
  })
}

function renderPlayback(video: HTMLVideoElement) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={subtitlesStore}>
      <SubtitlesUIContext
        value={
          { getVideoElement: () => video } as unknown as React.ContextType<
            typeof SubtitlesUIContext
          >
        }
      >
        {children}
      </SubtitlesUIContext>
    </Provider>
  )
  return renderHook(() => useLookupPlayback(), { wrapper })
}

function advancePastResumeDelay() {
  act(() => {
    vi.advanceTimersByTime(250)
  })
}

describe("useLookupPlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    subtitlesStore.set(closeWordLookupAtom)
    vi.useRealTimers()
  })

  it("pauses a playing video on open and resumes it shortly after close", () => {
    const { video, pause, play } = createVideo(false)
    renderPlayback(video)

    setOpen(true)
    expect(pause).toHaveBeenCalledTimes(1)

    setOpen(false)
    expect(play).not.toHaveBeenCalled()
    advancePastResumeDelay()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("leaves a video the viewer had already paused alone", () => {
    const { video, pause, play } = createVideo(true)
    renderPlayback(video)

    setOpen(true)
    setOpen(false)
    advancePastResumeDelay()

    expect(pause).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it("does not resume when the viewer pressed play while the card was open", () => {
    const { video, play, pressPlay } = createVideo(false)
    renderPlayback(video)

    setOpen(true)
    act(pressPlay)
    setOpen(false)
    advancePastResumeDelay()

    expect(play).not.toHaveBeenCalled()
  })

  it("keeps the pause when a second word reopens the card within the resume delay", () => {
    const { video, pause, play } = createVideo(false)
    renderPlayback(video)

    setOpen(true)
    setOpen(false)
    setOpen(true)
    advancePastResumeDelay()
    expect(play).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalledTimes(1)

    setOpen(false)
    advancePastResumeDelay()
    expect(play).toHaveBeenCalledTimes(1)
  })
})
