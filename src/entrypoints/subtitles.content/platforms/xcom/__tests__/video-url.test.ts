// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { getCurrentXcomVideoUrl } from "../dom"

function addPostWithVideo(statusPath: string) {
  const article = document.createElement("article")
  const link = document.createElement("a")
  link.href = `https://x.com${statusPath}`
  const player = document.createElement("div")
  player.dataset.testid = "videoComponent"
  player.append(document.createElement("video"))
  article.append(link, player)
  document.body.append(article)
}

describe("getCurrentXcomVideoUrl", () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it("links to the playing video's own post, which a timeline URL does not name", () => {
    addPostWithVideo("/someone/status/1234567890")

    expect(getCurrentXcomVideoUrl()).toBe("https://x.com/i/status/1234567890")
  })

  it("has no link when no video can be found", () => {
    expect(getCurrentXcomVideoUrl()).toBeNull()
  })
})
