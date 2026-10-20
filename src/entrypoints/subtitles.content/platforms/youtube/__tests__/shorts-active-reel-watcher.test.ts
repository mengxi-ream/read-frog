// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { watchShortsActiveReel } from "../shorts-active-reel-watcher"

function renderShorts() {
  document.body.innerHTML = `
    <ytd-shorts>
      <div id="reel-0" class="reel-video-in-sequence-new">
        <div id="reel-overlay-container"></div>
      </div>
      <div id="reel-1" class="reel-video-in-sequence-new"></div>
    </ytd-shorts>
  `
}

function moveOverlayTo(reelId: string) {
  document.getElementById(reelId)!.append(document.getElementById("reel-overlay-container")!)
}

describe("watchShortsActiveReel", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.useRealTimers()
  })

  it("reports the reel the overlay moves to once the change settles", async () => {
    vi.useFakeTimers()
    renderShorts()
    const onChanged = vi.fn<(...args: any[]) => any>()
    const stop = watchShortsActiveReel(onChanged)

    moveOverlayTo("reel-1")
    await vi.advanceTimersByTimeAsync(300)

    expect(onChanged).toHaveBeenCalledOnce()
    stop()
  })

  it("stops reporting once disconnected, including a change still debouncing", async () => {
    vi.useFakeTimers()
    renderShorts()
    const onChanged = vi.fn<(...args: any[]) => any>()
    const stop = watchShortsActiveReel(onChanged)

    moveOverlayTo("reel-1")
    await vi.advanceTimersByTimeAsync(50)
    stop()
    await vi.advanceTimersByTimeAsync(500)
    moveOverlayTo("reel-0")
    await vi.advanceTimersByTimeAsync(500)

    expect(onChanged).not.toHaveBeenCalled()
  })
})
