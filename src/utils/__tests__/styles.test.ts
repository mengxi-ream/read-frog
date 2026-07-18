// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { addStyleToShadow } from "../styles"

vi.mock("sonner/dist/styles.css?inline", () => ({
  default: "[data-sonner-toaster] { position: fixed; }",
}))

function createShadowDocument() {
  const host = document.createElement("div")
  const shadow = host.attachShadow({ mode: "open" })
  const html = document.createElement("html")
  const head = document.createElement("head")
  const body = document.createElement("body")
  html.append(head, body)
  shadow.append(html)
  document.body.append(host)

  return { head, shadow }
}

describe("addStyleToShadow", () => {
  afterEach(() => {
    document.head.querySelectorAll("style").forEach((style) => style.remove())
    document.body.innerHTML = ""
  })

  it("injects only Sonner's stylesheet instead of cloning a matching page bundle", () => {
    const pageStyle = document.createElement("style")
    pageStyle.textContent = `
      html, body { height: 100%; background: white; }
      [data-sonner-toaster] { position: fixed; }
    `
    document.head.append(pageStyle)
    const { head, shadow } = createShadowDocument()

    addStyleToShadow(shadow)
    addStyleToShadow(shadow)

    const injectedStyles = head.querySelectorAll("style[data-read-frog-sonner-styles]")
    expect(injectedStyles).toHaveLength(1)
    expect(injectedStyles[0].textContent).toContain("[data-sonner-toaster]")
    expect(injectedStyles[0].textContent).not.toContain("background: white")
    expect(injectedStyles[0].textContent).not.toBe(pageStyle.textContent)
  })
})
