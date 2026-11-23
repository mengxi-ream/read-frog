// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { getCurrentXcomSubtitlesVideo } from "../dom"

const CARD_MEDIA_TESTID = "card.layoutLarge.media"

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

afterEach(() => {
  document.body.replaceChildren()
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
