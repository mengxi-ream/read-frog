// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  mountPrimeVideoTranslateButton,
  removePrimeVideoTranslateButton,
} from "../translate-button"

vi.mock("../../../renderer/render-translate-button", () => ({
  renderSubtitlesTranslateButton: () => document.createElement("read-frog-button"),
}))
vi.mock("@/utils/react-shadow-host/create-shadow-host", () => ({
  removeReactShadowHost: (host: Element) => host.remove(),
}))

const adapter = {} as Parameters<typeof mountPrimeVideoTranslateButton>[0]

function renderRow() {
  document.body.innerHTML = `
    <div id="top-right">
      <div><button id="atvwebplayersdk-captions-toggle-button" style="position: relative; z-index: 120"></button></div>
      <div><button id="atvwebplayersdk-fullscreen-toggle-button"></button></div>
      <div><button id="atvwebplayersdk-settings-button"></button></div>
    </div>`
  return document.getElementById("top-right")!
}

afterEach(() => {
  removePrimeVideoTranslateButton()
  document.body.innerHTML = ""
})

describe("mountPrimeVideoTranslateButton", () => {
  it("puts the button last in the row, stacked as Prime's own buttons so an open menu leaves it clickable", () => {
    const row = renderRow()

    mountPrimeVideoTranslateButton(adapter)

    const button = row.lastElementChild as HTMLElement
    expect(button.tagName).toBe("READ-FROG-BUTTON")
    expect(button.style.position).toBe("relative")
    expect(button.style.zIndex).toBe("120")

    mountPrimeVideoTranslateButton(adapter)
    expect(row.lastElementChild).toBe(button)
  })

  it("puts the button back once Prime rebuilds its controls", () => {
    renderRow()
    mountPrimeVideoTranslateButton(adapter)

    const rebuilt = renderRow()
    mountPrimeVideoTranslateButton(adapter)

    expect(rebuilt.lastElementChild?.tagName).toBe("READ-FROG-BUTTON")
    expect(document.querySelectorAll("read-frog-button")).toHaveLength(1)
  })
})
