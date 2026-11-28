// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"
import { findTopRightRow } from "../dom"

// Prime's top-right row as the page has it, hashed class names left out.
const TOP_RIGHT_ROW = `
  <div id="top-right">
    <div><button id="atvwebplayersdk-captions-toggle-button"></button><div>tooltip</div></div>
    <div><div><button id="atvwebplayersdk-mute-toggle-button"></button></div></div>
    <div><button id="atvwebplayersdk-fullscreen-toggle-button"></button></div>
    <div><button id="atvwebplayersdk-settings-button"></button></div>
  </div>`

afterEach(() => {
  document.body.innerHTML = ""
})

describe("findTopRightRow", () => {
  it("finds the row holding Prime's fullscreen and settings buttons", () => {
    document.body.innerHTML = `<div id="dv-web-player">${TOP_RIGHT_ROW}</div>`

    expect(findTopRightRow()).toBe(document.getElementById("top-right"))
  })

  it("finds nothing while the controls are hidden", () => {
    document.body.innerHTML = `<div id="dv-web-player"></div>`

    expect(findTopRightRow()).toBeNull()
  })
})
