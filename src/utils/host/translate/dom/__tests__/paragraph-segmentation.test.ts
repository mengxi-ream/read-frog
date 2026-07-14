// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import {
  buildVirtualParagraphUnits,
  liftParagraphInsertionBoundary,
  moveParagraphInsertionBoundaryAfterTrailingInlineImages,
  type DOMBoundary,
} from "../paragraph-segmentation"

function setHost(host: string): void {
  Object.defineProperty(window, "location", {
    value: new URL(`https://${host}/some/path`),
    writable: true,
    configurable: true,
  })
}

function createRoot(whiteSpace: string = "pre-wrap"): HTMLDivElement {
  const root = document.createElement("div")
  root.style.whiteSpace = whiteSpace
  return root
}

function configWithSiteRule(rule: NonNullable<Config["siteRules"]>["userRules"][number]): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.siteRules = {
    userRules: [rule],
    disabledBuiltInRules: [],
  }
  return config
}

function insertAtBoundary(boundary: DOMBoundary, marker: HTMLElement): void {
  if (boundary.container.nodeType === Node.TEXT_NODE) {
    const text = boundary.container as Text
    const tail = text.splitText(boundary.offset)
    tail.parentNode?.insertBefore(marker, tail)
    return
  }

  boundary.container.insertBefore(marker, boundary.container.childNodes[boundary.offset] ?? null)
}

beforeEach(() => {
  setHost("paragraph.example")
})

describe("buildVirtualParagraphUnits", () => {
  it.each(["pre", "pre-wrap", "pre-line", "break-spaces"])(
    "segments literal blank lines for white-space: %s",
    (whiteSpace) => {
      const root = createRoot(whiteSpace)
      root.textContent = "First paragraph\n\nSecond paragraph"

      const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

      expect(units.map(({ id, text }) => ({ id, text }))).toEqual([
        { id: 0, text: "First paragraph" },
        { id: 1, text: "Second paragraph" },
      ])
    },
  )

  it.each(["normal", "nowrap"])(
    "preserves the legacy single-unit path for white-space: %s",
    (whiteSpace) => {
      const root = createRoot(whiteSpace)
      root.textContent = "First paragraph\n\nSecond paragraph"

      expect(buildVirtualParagraphUnits(root, DEFAULT_CONFIG)).toEqual([])
    },
  )

  it("does not split a single preserved newline", () => {
    const root = createRoot()
    root.textContent = "#MLB\n#Redsox"

    expect(buildVirtualParagraphUnits(root, DEFAULT_CONFIG)).toEqual([])
  })

  it("keeps a single newline inside a paragraph split by a blank line", () => {
    const root = createRoot()
    root.textContent = "Score\n\n#MLB\n#Redsox"

    const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

    expect(units.map((unit) => unit.text)).toEqual(["Score", "#MLB\n#Redsox"])
  })

  it("accepts CRLF delimiters with horizontal whitespace", () => {
    const root = createRoot()
    root.textContent = "First\r\n \t\r\nSecond"

    const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

    expect(units.map((unit) => unit.text)).toEqual(["First", "Second"])
  })

  it("recognizes a delimiter that crosses Text nodes", () => {
    const root = createRoot()
    const firstText = document.createTextNode("First\n")
    const span = document.createElement("span")
    const secondText = document.createTextNode("\nSecond")
    span.appendChild(secondText)
    root.append(firstText, span)

    const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

    expect(units.map((unit) => unit.text)).toEqual(["First", "Second"])
    expect(units[0].insertionBoundary).toEqual({ container: firstText, offset: 5 })
    expect(units[1].sourceFragments).toEqual([
      { source: secondText, startOffset: 1, endOffset: 7, atomic: false },
    ])
  })

  it("places the final virtual paragraph after trailing inline images with alt text", () => {
    const root = createRoot()
    const source = document.createElement("span")
    source.textContent = "First paragraph\n\nSecond paragraph"
    const emojiImages = ["✡️", "✝️", "🙏🏻", "♥️"].map((alt) => {
      const image = document.createElement("img")
      image.alt = alt
      image.style.display = "inline-block"
      return image
    })
    root.append(
      source,
      " ",
      emojiImages[0],
      "\t",
      emojiImages[1],
      "  ",
      emojiImages[2],
      emojiImages[3],
      " ",
    )

    const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

    expect(units.map((unit) => unit.text)).toEqual(["First paragraph", "Second paragraph"])
    expect(units[1].insertionBoundary).toEqual({
      container: root,
      offset: root.childNodes.length,
    })
    expect(
      units.flatMap((unit) => unit.sourceFragments).map((fragment) => fragment.source),
    ).not.toEqual(expect.arrayContaining(emojiImages))
  })

  it.each([
    {
      label: "a block image",
      createTrailingNode: () => {
        const image = document.createElement("img")
        image.alt = "♥️"
        image.style.display = "block"
        return image
      },
    },
    {
      label: "an inline image without alt text",
      createTrailingNode: () => {
        const image = document.createElement("img")
        image.style.display = "inline-block"
        return image
      },
    },
    {
      label: "an inline SVG",
      createTrailingNode: () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.style.display = "inline-block"
        return svg
      },
    },
    {
      label: "a hidden inline image",
      createTrailingNode: () => {
        const image = document.createElement("img")
        image.alt = "♥️"
        image.style.display = "inline-block"
        image.style.visibility = "hidden"
        return image
      },
    },
  ])("does not move the final boundary past $label", ({ createTrailingNode }) => {
    const root = createRoot()
    const source = document.createElement("span")
    source.textContent = "First paragraph\n\nSecond paragraph"
    root.append(source, createTrailingNode())

    const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

    expect(units[1].insertionBoundary).toEqual({ container: root, offset: 1 })
  })

  it("does not move a paragraph boundary past a trailing control", () => {
    const root = createRoot()
    const source = document.createElement("span")
    source.textContent = "Paragraph"
    const button = document.createElement("button")
    button.textContent = "Show more"
    root.append(source, button)

    expect(
      moveParagraphInsertionBoundaryAfterTrailingInlineImages(
        { container: source, offset: source.childNodes.length },
        root,
      ),
    ).toEqual({ container: source, offset: source.childNodes.length })
  })

  it.each([
    ["a newline", "\n"],
    ["real text", "next paragraph"],
  ])("does not move a paragraph boundary past %s", (_label, trailingText) => {
    const root = createRoot()
    const source = document.createElement("span")
    source.textContent = "Paragraph"
    root.append(source, document.createTextNode(trailingText))
    const originalBoundary = { container: source, offset: source.childNodes.length }

    expect(moveParagraphInsertionBoundaryAfterTrailingInlineImages(originalBoundary, root)).toEqual(
      originalBoundary,
    )
  })

  it("keeps a preserve-text mention atomic inside its surrounding paragraph", () => {
    setHost("preserve.example")
    const config = configWithSiteRule({
      id: "preserve",
      matches: "preserve.example",
      preserveTextSelectors: ["a.mention"],
    })
    const root = createRoot()
    const before = document.createTextNode("Today we welcome ")
    const mention = document.createElement("a")
    mention.className = "mention"
    mention.textContent = "@SohunSanka"
    const after = document.createTextNode(" as our new head of GTM.\n\nNext paragraph")
    root.append(before, mention, after)

    const units = buildVirtualParagraphUnits(root, config)

    expect(units.map((unit) => unit.text)).toEqual([
      "Today we welcome @SohunSanka as our new head of GTM.",
      "Next paragraph",
    ])
    expect(units[0].sourceFragments).toEqual([
      { source: before, startOffset: 0, endOffset: 17, atomic: false },
      { source: mention, startOffset: 0, endOffset: 11, atomic: true },
      { source: after, startOffset: 0, endOffset: 24, atomic: false },
    ])
  })

  it("does not interpret blank lines inside a dont-walk element as delimiters", () => {
    const root = createRoot()
    const code = document.createElement("code")
    code.textContent = "literal\n\nvalue"
    root.append("Before ", code, "\n\nAfter")

    const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

    expect(units.map((unit) => unit.text)).toEqual(["Before literal\n\nvalue", "After"])
    expect(units[0].sourceFragments[1]).toEqual({
      source: code,
      startOffset: 0,
      endOffset: 14,
      atomic: true,
    })
  })

  it("skips translated wrappers without joining newlines across the skipped subtree", () => {
    const root = createRoot()
    const wrapper = document.createElement("span")
    wrapper.className = CONTENT_WRAPPER_CLASS
    wrapper.textContent = "already translated"
    root.append("One\n", wrapper, "\nTwo\n\nThree")

    const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

    expect(units.map((unit) => unit.text)).toEqual(["One\n\nTwo", "Three"])
    expect(
      units.flatMap((unit) => unit.sourceFragments).some((fragment) => fragment.source === wrapper),
    ).toBe(false)
  })

  it("skips site-rule-excluded subtrees without joining newlines across them", () => {
    setHost("exclude.example")
    const config = configWithSiteRule({
      id: "exclude",
      matches: "exclude.example",
      excludeSelectors: [".skip"],
    })
    const root = createRoot()
    const excluded = document.createElement("span")
    excluded.className = "skip"
    excluded.textContent = "visible but excluded"
    root.append("One\n", excluded, "\nTwo\n\nThree")

    const units = buildVirtualParagraphUnits(root, config)

    expect(units.map((unit) => unit.text)).toEqual(["One\n\nTwo", "Three"])
    expect(units.map((unit) => unit.text).join(" ")).not.toContain("visible but excluded")
  })

  it("lifts a terminal preserve-text anchor boundary to the logical source", () => {
    setHost("preserve.example")
    const config = configWithSiteRule({
      id: "preserve",
      matches: "preserve.example",
      preserveTextSelectors: ["a.mention"],
    })
    const root = createRoot()
    const leading = document.createTextNode("First\n\n")
    const span = document.createElement("span")
    const mention = document.createElement("a")
    mention.className = "mention"
    mention.textContent = "@SohunSanka"
    span.appendChild(mention)
    root.append(leading, span)

    const units = buildVirtualParagraphUnits(root, config)

    expect(units[1].insertionBoundary).toEqual({ container: root, offset: 2 })
  })

  it("lifts a boundary out of a terminal BUTTON even when excluded children follow its text", () => {
    const root = createRoot()
    const button = document.createElement("button")
    const text = document.createTextNode("Share")
    const icon = document.createElement("svg")
    button.append(text, icon)
    root.appendChild(button)

    const boundary = liftParagraphInsertionBoundary(
      { container: text, offset: text.data.length },
      root,
      DEFAULT_CONFIG,
    )

    expect(boundary).toEqual({ container: root, offset: 1 })
  })

  it("returns boundaries that support reverse splitText insertion", () => {
    const root = createRoot()
    const source = document.createTextNode("One\n\nTwo\n\nThree")
    root.appendChild(source)
    const units = buildVirtualParagraphUnits(root, DEFAULT_CONFIG)

    for (const unit of [...units].reverse()) {
      const marker = document.createElement("i")
      marker.dataset.paragraphId = String(unit.id)
      insertAtBoundary(unit.insertionBoundary, marker)
    }

    expect([...root.childNodes].map((node) => node.textContent)).toEqual([
      "One",
      "",
      "\n\nTwo",
      "",
      "\n\nThree",
      "",
    ])
    expect([...root.querySelectorAll("i")].map((node) => node.dataset.paragraphId)).toEqual([
      "0",
      "1",
      "2",
    ])
  })
})
