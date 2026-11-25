// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://x.com/home" }
import { afterEach, describe, expect, it } from "vitest"
import { getCurrentXcomSubtitlesVideo } from "../dom"

const CARD_MEDIA_TESTID = "card.layoutLarge.media"
// Moving between posts in the media view rewrites the URL to `/photo/1`, even on a video.
const MEDIA_VIEW_PATH = "/NASA/status/2123820070803542306/photo/1"
const MEDIA_VIEW_SLIDE = `<li role="listitem"><div data-testid="videoComponent"><video></video></div></li>`
// As read on x.com, the slide before the one shown sat at x = -1357.
const OFF_SCREEN_SLIDE_RECT = { left: -1357, width: 1357, height: 763 } as DOMRect

function addPostWithVideo() {
  const article = document.createElement("article")
  const link = document.createElement("a")
  link.href = "https://x.com/NASA/status/2123820070803542306"
  const player = document.createElement("div")
  player.dataset.testid = "videoComponent"
  const video = document.createElement("video")
  player.append(video)
  article.append(link, player)
  document.body.append(article)
  return { article, player, video }
}

function hideFromScreenReaders({ element, testid }: { element: HTMLElement; testid?: string }) {
  const hidden = document.createElement("div")
  hidden.setAttribute("aria-hidden", "true")
  if (testid) {
    hidden.dataset.testid = testid
  }
  element.replaceWith(hidden)
  hidden.append(element)
}

function openMediaView({ slides }: { slides: number }): HTMLVideoElement[] {
  window.history.pushState({}, "", MEDIA_VIEW_PATH)
  const dialog = document.createElement("div")
  dialog.setAttribute("role", "dialog")
  dialog.setAttribute("aria-modal", "true")
  dialog.innerHTML = `<ul role="list">${MEDIA_VIEW_SLIDE.repeat(slides)}</ul>`
  document.body.append(dialog)
  return Array.from(dialog.querySelectorAll("video"))
}

afterEach(() => {
  document.body.replaceChildren()
  window.history.pushState({}, "", "/home")
})

describe("getCurrentXcomSubtitlesVideo", () => {
  it("finds a video in a card, as a broadcast replay, though X hides card media from readers", () => {
    const { player, video } = addPostWithVideo()
    hideFromScreenReaders({ element: player, testid: CARD_MEDIA_TESTID })

    expect(getCurrentXcomSubtitlesVideo()).toBe(video)
  })

  it("skips a video under any other hidden element", () => {
    const { player } = addPostWithVideo()
    hideFromScreenReaders({ element: player })

    expect(getCurrentXcomSubtitlesVideo()).toBeNull()
  })

  it("skips a card's video while its post is hidden, as behind a dialog", () => {
    const { article, player } = addPostWithVideo()
    hideFromScreenReaders({ element: player, testid: CARD_MEDIA_TESTID })
    hideFromScreenReaders({ element: article })

    expect(getCurrentXcomSubtitlesVideo()).toBeNull()
  })
})

describe("getCurrentXcomSubtitlesVideo in X's media view", () => {
  it("finds the video the media view shows, which has no post around it", () => {
    const { article } = addPostWithVideo()
    hideFromScreenReaders({ element: article })
    const [shown] = openMediaView({ slides: 1 })

    expect(getCurrentXcomSubtitlesVideo()).toBe(shown)
  })

  it("skips the slides the media view keeps mounted off screen", () => {
    const [previous, shown] = openMediaView({ slides: 2 })
    previous!.getBoundingClientRect = () => OFF_SCREEN_SLIDE_RECT

    expect(getCurrentXcomSubtitlesVideo()).toBe(shown)
  })

  it("skips a video in a dialog whose URL names no post, as a draft's", () => {
    openMediaView({ slides: 1 })
    window.history.pushState({}, "", "/compose/post")

    expect(getCurrentXcomSubtitlesVideo()).toBeNull()
  })
})
