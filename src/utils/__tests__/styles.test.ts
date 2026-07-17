// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"

const SONNER_STYLE_TEXT = "[data-sonner-toaster]{position:fixed}"

vi.mock("sonner", () => {
  const style = document.createElement("style")
  style.dataset.readFrogTestSonner = ""
  style.textContent = "[data-sonner-toaster]{position:fixed}"
  document.head.append(style)

  return {}
})

import { addStyleToShadow, protectInternalStyles } from "../styles"

describe("Sonner style isolation", () => {
  it("moves only the style injected by this bundle into the shadow root", () => {
    const hostStyle = document.createElement("style")
    hostStyle.dataset.hostSonner = ""
    hostStyle.textContent = `${SONNER_STYLE_TEXT}[data-sonner-toast]{--offset:32px}`
    document.head.prepend(hostStyle)

    const shadowHost = document.createElement("div")
    const shadowRoot = shadowHost.attachShadow({ mode: "open" })
    const shadowHead = document.createElement("head")
    shadowRoot.append(shadowHead)

    const injectedStyle = document.head.querySelector("[data-read-frog-test-sonner]")
    addStyleToShadow(shadowRoot)

    expect(shadowHead.querySelector("[data-read-frog-test-sonner]")).toBe(injectedStyle)
    expect(document.head.querySelector("[data-host-sonner]")).toBe(hostStyle)
  })

  it("does not treat a host Sonner stylesheet as an internal extension style", async () => {
    const hostStyle = document.createElement("style")
    hostStyle.textContent = SONNER_STYLE_TEXT
    document.head.append(hostStyle)

    const stopProtecting = protectInternalStyles()
    hostStyle.remove()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(hostStyle.isConnected).toBe(false)
    stopProtecting()
  })
})
