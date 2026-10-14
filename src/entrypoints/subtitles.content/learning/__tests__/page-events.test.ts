// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { isFromSubtitleLine } from "../page-events"

function clickOn(target: Element) {
  let fromLine = false
  target.addEventListener("click", (event) => {
    fromLine = isFromSubtitleLine(event)
  })
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
  return fromLine
}

describe("isFromSubtitleLine", () => {
  it("recognizes a press on a word inside the subtitle line's shadow root", () => {
    const host = document.createElement("div")
    document.body.append(host)
    const line = document.createElement("span")
    line.dataset.slot = "subtitle-line"
    const word = document.createElement("span")
    line.append(word)
    host.attachShadow({ mode: "open" }).append(line)

    expect(clickOn(word)).toBe(true)
  })

  it("ignores a press elsewhere on the page", () => {
    const button = document.createElement("button")
    document.body.append(button)

    expect(clickOn(button)).toBe(false)
  })
})
