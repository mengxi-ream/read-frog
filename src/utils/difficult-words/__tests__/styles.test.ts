import { describe, expect, it } from "vitest"
import { HIGHLIGHT_NAMES } from "../highlights"
import { buildDifficultWordsDocumentCss } from "../styles"

describe("buildDifficultWordsDocumentCss", () => {
  it("leaves the readings above a marked word unpainted, in every highlight", () => {
    const css = buildDifficultWordsDocumentCss()

    for (const name of HIGHLIGHT_NAMES) {
      expect(css).toContain(
        `rt::highlight(${name}), rp::highlight(${name}) { background-color: transparent; color: currentcolor; }`,
      )
    }
  })
})
