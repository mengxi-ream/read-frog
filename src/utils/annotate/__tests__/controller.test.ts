// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AnnotationController } from "../controller"
import { ANNOTATION_LEADING_ATTRIBUTE } from "../styles"

// jsdom has no layout: the layer stands in, and what is under test is whether
// a gloss fits.
vi.mock("../layer", () => ({
  AnnotationLayer: class {
    set() {}
    delete() {}
    dispose() {}
    scheduleRelayout() {}
  },
}))

const INLINE = new Set(["a", "b", "span"])

/** A browser's computed styles, over its defaults, given per element. */
function stubComputedStyles(styles: Map<Element, Record<string, string>>) {
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const values: Record<string, string> = {
      display: INLINE.has(element.localName) ? "inline" : "block",
      writingMode: "horizontal-tb",
      position: "static",
      overflowY: "visible",
      maxHeight: "none",
      fontSize: "16px",
      lineHeight: "normal",
      "-webkit-line-clamp": "none",
      ...styles.get(element),
    }
    return {
      ...values,
      getPropertyValue: (name: string) => values[name] ?? "",
    } as unknown as CSSStyleDeclaration
  })
}

/** A comment line opening with a small link, as YouTube's @mentions and timestamps are. */
function lineAfterSmallLink() {
  const block = document.createElement("p")
  const link = document.createElement("a")
  link.textContent = "@frog"
  block.append(link, "Anyone from 2026?")
  document.body.append(block)
  stubComputedStyles(new Map([[link, { fontSize: "10px" }]]))
  return { block, link, word: block.lastChild as Text }
}

let controller: AnnotationController

beforeEach(() => {
  controller = new AnnotationController({ removeLabel: "Remove" })
  // jsdom has no Range#getClientRects: with no rects a measurement falls back
  // to the font size.
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  })
})

afterEach(() => {
  controller.dispose()
  Reflect.deleteProperty(Range.prototype, "getClientRects")
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe("whether a gloss fits under an annotation", () => {
  it("measures the annotated text, not the node a selection starts at the end of", () => {
    const { link, word } = lineAfterSmallLink()
    // A drag that starts right after the link: the browser may put the start
    // at the end of the link's text rather than at the start of the word's.
    const range = document.createRange()
    range.setStart(link.firstChild!, link.textContent.length)
    range.setEnd(word, "Anyone".length)

    const result = controller.annotate(range)

    expect(result.ok && result.record.surface).toBe("Anyone")
    expect(result.ok && result.record.glossFits).toBe(true)
  })

  it("still gives text too small for a gloss the mark only", () => {
    const { link } = lineAfterSmallLink()
    const range = document.createRange()
    range.setStart(link.firstChild!, 1)
    range.setEnd(link.firstChild!, 5)

    const result = controller.annotate(range)

    expect(result.ok && result.record.surface).toBe("frog")
    expect(result.ok && result.record.glossFits).toBe(false)
  })
})

describe("annotations in a shadow root", () => {
  /** Whether the root has the styles that give a gloss its line-height. */
  function hasLeadingStyles(root: Document | ShadowRoot) {
    return root.adoptedStyleSheets.some((sheet) =>
      [...sheet.cssRules].some((rule) => rule.cssText.includes(ANNOTATION_LEADING_ATTRIBUTE)),
    )
  }

  function annotateFirstWord(block: Element) {
    const text = block.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, text.data.indexOf(" "))
    const result = controller.annotate(range)
    if (!result.ok) throw new Error(`not annotated: ${result.reason}`)
    return result.record.id
  }

  it("gets the line-height styles there until its last annotated block lets go", () => {
    // The document's styles stop at the shadow root.
    const host = document.createElement("div")
    document.body.append(host)
    const root = host.attachShadow({ mode: "open" })
    const first = document.createElement("p")
    first.textContent = "Anyone from 2026?"
    const second = document.createElement("p")
    second.textContent = "Still here today."
    root.append(first, second)
    stubComputedStyles(new Map())

    const firstId = annotateFirstWord(first)
    const secondId = annotateFirstWord(second)
    expect(hasLeadingStyles(root)).toBe(true)

    controller.remove(firstId)
    expect(hasLeadingStyles(root)).toBe(true)

    controller.remove(secondId)
    expect(hasLeadingStyles(root)).toBe(false)
    expect(hasLeadingStyles(document)).toBe(true)
  })
})
