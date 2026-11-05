// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"
import { EDX_ACTIVE_VIDEO_SELECTOR } from "@/utils/constants/subtitles"
import { getEdxVideoId } from "@/utils/subtitles/video-id"
import { markActiveEdxVideo } from "../dom"

function addVideoBlock(blockId: string, { html5 = true } = {}): HTMLElement {
  const block = document.createElement("div")
  block.className = "video"
  block.dataset.blockId = blockId
  block.dataset.metadata = "{}"
  block.innerHTML = html5
    ? '<div class="video-player"><video></video></div>'
    : '<div class="video-player"><iframe></iframe></div>'
  document.body.append(block)
  return block
}

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("markActiveEdxVideo", () => {
  it("marks the first HTML5 video block, skipping one that plays from YouTube", () => {
    addVideoBlock("youtube", { html5: false })
    addVideoBlock("first")
    addVideoBlock("second")

    markActiveEdxVideo()

    expect(getEdxVideoId()).toBe("first")
  })

  it("moves the mark to the block that plays, and keeps it there after it pauses", () => {
    addVideoBlock("first")
    const second = addVideoBlock("second")
    markActiveEdxVideo()

    second.classList.add("is-playing")
    markActiveEdxVideo()
    expect(getEdxVideoId()).toBe("second")
    expect(document.querySelectorAll(EDX_ACTIVE_VIDEO_SELECTOR)).toHaveLength(1)

    second.classList.remove("is-playing")
    markActiveEdxVideo()
    expect(getEdxVideoId()).toBe("second")
  })

  it("moves the mark to a block that starts while another plays on, and keeps it there", () => {
    const first = addVideoBlock("first")
    const second = addVideoBlock("second")
    first.classList.add("is-playing")
    markActiveEdxVideo()
    expect(getEdxVideoId()).toBe("first")

    second.classList.add("is-playing")
    markActiveEdxVideo()
    expect(getEdxVideoId()).toBe("second")

    markActiveEdxVideo()
    expect(getEdxVideoId()).toBe("second")
  })

  it("marks nothing when no block plays HTML5 video", () => {
    addVideoBlock("youtube", { html5: false })

    markActiveEdxVideo()

    expect(getEdxVideoId()).toBeNull()
  })
})
