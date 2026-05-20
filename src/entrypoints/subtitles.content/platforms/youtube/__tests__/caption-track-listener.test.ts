// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { YOUTUBE_NAVIGATE_FINISH_EVENT } from "@/utils/constants/subtitles"
import { createYoutubeCaptionTrackListener } from "../caption-track-listener"

function flushObserver() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function renderSettingsMenu({
  expanded = true,
  menuLabel = "字幕",
  summary,
}: {
  expanded?: boolean
  menuLabel?: string
  summary: string
}) {
  document.body.innerHTML = `
    <div id="movie_player" class="html5-video-player">
      <button class="ytp-settings-button" aria-expanded="${expanded ? "true" : "false"}"></button>
      <div class="ytp-settings-menu">
        <div class="ytp-panel-menu" role="menu">
          <div class="ytp-menuitem" role="menuitem" aria-haspopup="true" tabindex="0">
            <div class="ytp-menuitem-label">
              <div>
                <span>${menuLabel}</span>
                <span class="ytp-menuitem-label-count"> (1)</span>
              </div>
            </div>
            <div class="ytp-menuitem-content">${summary}</div>
          </div>
        </div>
      </div>
    </div>
  `
}

function getSummaryNode() {
  return document.querySelector<HTMLElement>(".ytp-menuitem-content")
}

function clickSummaryItem() {
  document.querySelector<HTMLElement>(".ytp-menuitem")
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

describe("youtube caption track listener", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("treats the current subtitle summary as the baseline when the menu opens", async () => {
    renderSettingsMenu({
      summary: "英语 >> 中文",
    })

    const onTrackChanged = vi.fn()
    const listener = createYoutubeCaptionTrackListener({
      playerContainerSelector: "#movie_player",
      onTrackChanged,
    })

    listener.start()
    await flushObserver()

    expect(listener.getCurrentTrackKey()).toBe("top-level-summary::0::英语 >> 中文")
    expect(onTrackChanged).not.toHaveBeenCalled()
  })

  it("forwards changes when the subtitle summary text changes", async () => {
    renderSettingsMenu({
      summary: "英语 >> 中文",
    })

    const onTrackChanged = vi.fn()
    const listener = createYoutubeCaptionTrackListener({
      playerContainerSelector: "#movie_player",
      onTrackChanged,
    })

    listener.start()
    await flushObserver()

    getSummaryNode()!.textContent = "英语 (自动生成) >> 阿拉伯语"
    await flushObserver()

    expect(onTrackChanged).toHaveBeenCalledTimes(1)
    expect(onTrackChanged.mock.calls[0]?.[0]).toEqual({
      label: "英语 (自动生成) >> 阿拉伯语",
      menuHeading: "字幕",
      trackKey: "top-level-summary::0::英语 (自动生成) >> 阿拉伯语",
    })
    expect(onTrackChanged.mock.calls[0]?.[1]).toEqual({
      label: "英语 >> 中文",
      menuHeading: "字幕",
      trackKey: "top-level-summary::0::英语 >> 中文",
    })
  })

  it("does not depend on the YouTube UI language for the menu label", async () => {
    renderSettingsMenu({
      menuLabel: "Subtitles",
      summary: "English (auto-generated) >> Arabic",
    })

    const onTrackChanged = vi.fn()
    const listener = createYoutubeCaptionTrackListener({
      playerContainerSelector: "#movie_player",
      onTrackChanged,
    })

    listener.start()
    await flushObserver()

    getSummaryNode()!.textContent = "English >> Spanish"
    await flushObserver()

    expect(onTrackChanged).toHaveBeenCalledTimes(1)
    expect(onTrackChanged.mock.calls[0]?.[0]).toEqual({
      label: "English >> Spanish",
      menuHeading: "Subtitles",
      trackKey: "top-level-summary::0::English >> Spanish",
    })
    expect(onTrackChanged.mock.calls[0]?.[1]).toEqual({
      label: "English (auto-generated) >> Arabic",
      menuHeading: "Subtitles",
      trackKey: "top-level-summary::0::English (auto-generated) >> Arabic",
    })
  })

  it("deduplicates repeated summary values", async () => {
    renderSettingsMenu({
      summary: "英语 >> 中文",
    })

    const onTrackChanged = vi.fn()
    const listener = createYoutubeCaptionTrackListener({
      playerContainerSelector: "#movie_player",
      onTrackChanged,
    })

    listener.start()
    await flushObserver()

    getSummaryNode()!.textContent = "英语 (自动生成) >> 阿拉伯语"
    await flushObserver()
    getSummaryNode()!.textContent = "英语 (自动生成) >> 阿拉伯语"
    await flushObserver()

    expect(onTrackChanged).toHaveBeenCalledTimes(1)
  })

  it("falls back to a delayed reread after a menu click", async () => {
    vi.useFakeTimers()

    renderSettingsMenu({
      summary: "英语 >> 中文",
    })

    const onTrackChanged = vi.fn()
    const listener = createYoutubeCaptionTrackListener({
      playerContainerSelector: "#movie_player",
      onTrackChanged,
    })

    listener.start()
    await vi.runAllTimersAsync()

    clickSummaryItem()
    document.querySelector<HTMLElement>(".ytp-settings-button")?.setAttribute("aria-expanded", "false")
    getSummaryNode()!.textContent = "英语 (自动生成) >> 阿拉伯语"
    await vi.advanceTimersByTimeAsync(60)

    expect(onTrackChanged).toHaveBeenCalledTimes(1)
    expect(onTrackChanged.mock.calls[0]?.[0]).toEqual({
      label: "英语 (自动生成) >> 阿拉伯语",
      menuHeading: "字幕",
      trackKey: "top-level-summary::0::英语 (自动生成) >> 阿拉伯语",
    })
    expect(onTrackChanged.mock.calls[0]?.[1]).toEqual({
      label: "英语 >> 中文",
      menuHeading: "字幕",
      trackKey: "top-level-summary::0::英语 >> 中文",
    })
  })

  it("rebinds after YouTube navigation", async () => {
    renderSettingsMenu({
      summary: "英语 >> 中文",
    })

    const onTrackChanged = vi.fn()
    const listener = createYoutubeCaptionTrackListener({
      playerContainerSelector: "#movie_player",
      onTrackChanged,
    })

    listener.start()
    await flushObserver()

    renderSettingsMenu({
      summary: "德语 >> 中文",
    })

    window.dispatchEvent(new Event(YOUTUBE_NAVIGATE_FINISH_EVENT))
    await flushObserver()

    expect(listener.getCurrentTrackKey()).toBe("top-level-summary::0::德语 >> 中文")
    expect(onTrackChanged).not.toHaveBeenCalled()

    getSummaryNode()!.textContent = "英语 >> 中文"
    await flushObserver()

    expect(onTrackChanged).toHaveBeenCalledTimes(1)
    expect(onTrackChanged.mock.calls[0]?.[0]).toEqual({
      label: "英语 >> 中文",
      menuHeading: "字幕",
      trackKey: "top-level-summary::0::英语 >> 中文",
    })
    expect(onTrackChanged.mock.calls[0]?.[1]).toEqual({
      label: "德语 >> 中文",
      menuHeading: "字幕",
      trackKey: "top-level-summary::0::德语 >> 中文",
    })
  })
})
