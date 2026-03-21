import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const translationNodePresetCss = readFileSync(new URL("../translation-node-preset.css", import.meta.url), "utf8")

describe("translation-node-preset.css", () => {
  it("keeps a float-wrap override for block translations", () => {
    expect(translationNodePresetCss).toContain(".read-frog-translated-block-content[data-read-frog-float-wrap=\"true\"]")
    expect(translationNodePresetCss).toContain("display: block !important;")
  })
})
