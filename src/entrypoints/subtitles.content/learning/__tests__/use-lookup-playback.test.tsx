// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { Mock } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SubtitlesUIContext } from "../../ui/subtitles-ui-context"
import { useLookupPlayback } from "../use-lookup-playback"

interface FakePlayer {
  paused: boolean
  pauseVideo: Mock<() => void>
  playVideo: Mock<() => void>
  isVideoPaused: Mock<() => boolean>
}

function createPlayer(initiallyPaused: boolean) {
  const player: FakePlayer = {
    paused: initiallyPaused,
    pauseVideo: vi.fn<() => void>(() => {
      player.paused = true
    }),
    playVideo: vi.fn<() => void>(() => {
      player.paused = false
    }),
    isVideoPaused: vi.fn<() => boolean>(() => player.paused),
  }
  return player
}

function renderPlayback(player: FakePlayer, open: boolean) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SubtitlesUIContext
      value={{ ...player } as unknown as React.ContextType<typeof SubtitlesUIContext>}
    >
      {children}
    </SubtitlesUIContext>
  )
  return renderHook((props: { open: boolean }) => useLookupPlayback(props.open), {
    wrapper,
    initialProps: { open },
  })
}

describe("useLookupPlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("pauses a playing video on open and resumes it shortly after close", () => {
    const player = createPlayer(false)
    const { rerender } = renderPlayback(player, false)

    rerender({ open: true })
    expect(player.pauseVideo).toHaveBeenCalledTimes(1)

    rerender({ open: false })
    expect(player.playVideo).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(player.playVideo).toHaveBeenCalledTimes(1)
  })

  it("leaves a video the viewer had already paused alone", () => {
    const player = createPlayer(true)
    const { rerender } = renderPlayback(player, false)

    rerender({ open: true })
    rerender({ open: false })
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(player.pauseVideo).not.toHaveBeenCalled()
    expect(player.playVideo).not.toHaveBeenCalled()
  })

  it("does not resume when the viewer pressed play while the card was open", () => {
    const player = createPlayer(false)
    const { rerender } = renderPlayback(player, false)

    rerender({ open: true })
    act(() => {
      player.paused = false
      document.dispatchEvent(new Event("play"))
    })
    rerender({ open: false })
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(player.playVideo).not.toHaveBeenCalled()
  })

  it("keeps the pause when a second word reopens the card within the resume delay", () => {
    const player = createPlayer(false)
    const { rerender } = renderPlayback(player, false)

    rerender({ open: true })
    rerender({ open: false })
    rerender({ open: true })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(player.playVideo).not.toHaveBeenCalled()
    expect(player.pauseVideo).toHaveBeenCalledTimes(1)

    rerender({ open: false })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(player.playVideo).toHaveBeenCalledTimes(1)
  })
})
