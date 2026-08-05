// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { usePreventScrollThrough } from "../use-prevent-scroll-through"

interface Metrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

/** jsdom has no layout, so scroll metrics have to be declared explicitly. */
function setMetrics(element: HTMLElement, { scrollTop, scrollHeight, clientHeight }: Metrics) {
  Object.defineProperties(element, {
    scrollTop: { configurable: true, value: scrollTop, writable: true },
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
  })
}

function Harness({ element }: { element: HTMLElement | null }) {
  usePreventScrollThrough({ isEnabled: true, element })
  return null
}

let body: HTMLDivElement
let nested: HTMLDivElement
let leaf: HTMLParagraphElement

beforeEach(() => {
  body = document.createElement("div")
  nested = document.createElement("div")
  leaf = document.createElement("p")

  nested.style.overflowY = "scroll"
  nested.append(leaf)
  body.append(nested)
  document.body.append(body)
})

function wheel(target: HTMLElement, deltaY: number) {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe("usePreventScrollThrough", () => {
  it("lets a nested scroller consume the wheel when it still has room", () => {
    // The popover body itself cannot scroll — the case that used to swallow
    // every wheel event and leave the nested area draggable-scrollbar only.
    setMetrics(body, { scrollTop: 0, scrollHeight: 200, clientHeight: 200 })
    setMetrics(nested, { scrollTop: 0, scrollHeight: 180, clientHeight: 72 })

    render(<Harness element={body} />)

    expect(wheel(leaf, 120).defaultPrevented).toBe(false)
  })

  it("still blocks scroll-through once the nested scroller is exhausted", () => {
    setMetrics(body, { scrollTop: 0, scrollHeight: 200, clientHeight: 200 })
    setMetrics(nested, { scrollTop: 108, scrollHeight: 180, clientHeight: 72 })

    render(<Harness element={body} />)

    expect(wheel(leaf, 120).defaultPrevented).toBe(true)
  })

  it("ignores overflowing children that are not scrollers", () => {
    setMetrics(body, { scrollTop: 0, scrollHeight: 200, clientHeight: 200 })
    nested.style.overflowY = "hidden"
    setMetrics(nested, { scrollTop: 0, scrollHeight: 180, clientHeight: 72 })

    render(<Harness element={body} />)

    expect(wheel(leaf, 120).defaultPrevented).toBe(true)
  })

  it("keeps blocking at the body's own boundaries", () => {
    setMetrics(body, { scrollTop: 0, scrollHeight: 400, clientHeight: 200 })
    setMetrics(nested, { scrollTop: 0, scrollHeight: 72, clientHeight: 72 })

    render(<Harness element={body} />)

    expect(wheel(leaf, -120).defaultPrevented).toBe(true)
    expect(wheel(leaf, 120).defaultPrevented).toBe(false)
  })
})
