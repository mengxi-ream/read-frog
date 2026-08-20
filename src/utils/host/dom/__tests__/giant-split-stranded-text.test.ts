// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { canSplitGiantWithoutStrandingOwnText, walkAndLabelElement } from "../traversal"

/**
 * Build a fixture and run the REAL labeling walk over it, so the block labels
 * the predicate reads are the ones production writes.
 */
function walked(markup: string): HTMLElement {
  const root = document.createElement("div")
  root.innerHTML = markup
  document.body.append(root)
  walkAndLabelElement(root, "walk-1", DEFAULT_CONFIG)
  return root
}

describe("canSplitGiantWithoutStrandingOwnText", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("refuses when the container owns prose beside block children (Blogger post body)", () => {
    // The <br>s make it re-segmentable; the bare text between them is the
    // article itself, and a descendant split would strand all of it.
    const root = walked(
      `While f/stop and shutter speed both control exposure<br><br>` +
        `Since the light from your flash is instantaneous<i>as long as you are at sync speed</i>`,
    )

    expect(canSplitGiantWithoutStrandingOwnText(root)).toBe(false)
  })

  it("allows the split when the container owns no text at all (docs.docker.com)", () => {
    const root = walked(`<p>First paragraph</p><em>2026-08-17</em><p>Second paragraph</p>`)

    expect(canSplitGiantWithoutStrandingOwnText(root)).toBe(true)
  })

  it("allows the split when only whitespace sits between block children", () => {
    const root = walked(`
      <p>First paragraph</p>
      <p>Second paragraph</p>
    `)

    expect(canSplitGiantWithoutStrandingOwnText(root)).toBe(true)
  })

  it("allows the split when the container owns prose but has no block child", () => {
    // Refusing here would send the whole container as one request, because the
    // translate path takes its single-node branch without a block child.
    const root = walked(`bare sentence one<span>an inline fragment</span>bare sentence two`)

    expect(canSplitGiantWithoutStrandingOwnText(root)).toBe(true)
  })

  it.each([
    ["a separator", "·"],
    ["a pipe", " | "],
    ["an em dash", "—"],
    ["an ISO date", "2026-08-17"],
    ["a formatted number", "1,234.56"],
  ])("allows the split when the only own text is %s", (_label, stray) => {
    const root = walked(`<p>First paragraph</p>${stray}<p>Second paragraph</p>`)

    expect(canSplitGiantWithoutStrandingOwnText(root)).toBe(true)
  })

  it("refuses for CJK own text, which carries no ASCII letters", () => {
    const root = walked(`<p>First paragraph</p>这是正文，不能被拆掉<p>Second paragraph</p>`)

    expect(canSplitGiantWithoutStrandingOwnText(root)).toBe(false)
  })

  it("ignores script and style bodies, which are never bare text children", () => {
    const root = walked(
      `<p>First paragraph</p><script>const a = "text"</script>` +
        `<style>.a { color: red }</style><p>Second paragraph</p>`,
    )

    expect(canSplitGiantWithoutStrandingOwnText(root)).toBe(true)
  })
})
