import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import { resolveActionLayout } from "../resolve"

describe("resolveActionLayout", () => {
  it("uses the action's own layout when it has one", () => {
    const layout = "<p>{{ A }}</p>"
    expect(resolveActionLayout({ layout })).toBe(layout)
    // Surrounding whitespace is part of the layout, not a reason to replace it.
    expect(resolveActionLayout({ layout: `\n${layout}\n` })).toBe(`\n${layout}\n`)
  })

  it("falls back to the default field list for a missing or blank layout", () => {
    expect(resolveActionLayout({})).toBe(DEFAULT_LAYOUT)
    expect(resolveActionLayout({ layout: undefined })).toBe(DEFAULT_LAYOUT)
    expect(resolveActionLayout({ layout: null })).toBe(DEFAULT_LAYOUT)
    expect(resolveActionLayout({ layout: "" })).toBe(DEFAULT_LAYOUT)
    expect(resolveActionLayout({ layout: " \n\t " })).toBe(DEFAULT_LAYOUT)
  })
})
