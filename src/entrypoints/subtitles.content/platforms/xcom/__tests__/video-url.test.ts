// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { getCurrentXcomVideoUrl, getXcomVideoPostUrl } from "../dom"

const PAGE_STATUS_ID = "2119833829389041896"

const page = vi.hoisted(() => ({ statusId: null as string | null }))

vi.mock("@/utils/subtitles/video-id", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/subtitles/video-id")>()),
  getXcomStatusId: () => page.statusId,
}))

function addPostWithVideo(statusPath?: string): HTMLVideoElement {
  const article = document.createElement("article")
  const link = document.createElement("a")
  link.href = `https://x.com${statusPath ?? "/an-advertiser"}`
  const player = document.createElement("div")
  player.dataset.testid = "videoComponent"
  const video = document.createElement("video")
  player.append(video)
  article.append(link, player)
  document.body.append(article)
  return video
}

afterEach(() => {
  document.body.replaceChildren()
  page.statusId = null
})

describe("getCurrentXcomVideoUrl", () => {
  it("links to the playing video's own post, which a timeline URL does not name", () => {
    addPostWithVideo("/someone/status/1234567890")

    expect(getCurrentXcomVideoUrl()).toBe("https://x.com/i/status/1234567890")
  })

  it("has no link when no video can be found", () => {
    expect(getCurrentXcomVideoUrl()).toBeNull()
  })
})

describe("getXcomVideoPostUrl", () => {
  it("links to the post holding the video", () => {
    const video = addPostWithVideo("/someone/status/1234567890")

    expect(getXcomVideoPostUrl(video)).toBe("https://x.com/i/status/1234567890")
  })

  it("never lends the page's post to a video whose post links to none, as an ad", () => {
    page.statusId = PAGE_STATUS_ID
    const ad = addPostWithVideo()

    expect(getCurrentXcomVideoUrl()).toBe(`https://x.com/i/status/${PAGE_STATUS_ID}`)
    expect(getXcomVideoPostUrl(ad)).toBeNull()
  })

  it("links a video in the media view, which no post holds, to the post its URL names", () => {
    page.statusId = PAGE_STATUS_ID
    const mediaView = document.createElement("div")
    mediaView.setAttribute("role", "dialog")
    mediaView.setAttribute("aria-modal", "true")
    const video = document.createElement("video")
    mediaView.append(video)
    document.body.append(mediaView)

    expect(getXcomVideoPostUrl(video)).toBe(`https://x.com/i/status/${PAGE_STATUS_ID}`)
  })
})
