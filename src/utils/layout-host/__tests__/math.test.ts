import type { LayoutMath } from "@read-frog/layout-engine/core"
import { compileLayout, renderLayoutHtml } from "@read-frog/layout-engine/core"
import { describe, expect, it } from "vitest"
import { buildCustomActionLayoutScope } from "../host"
import { loadLayoutMath } from "../math"

function render(source: string, formula: string, math?: LayoutMath) {
  const compiled = compileLayout(source)
  if (!compiled.ok) throw compiled.error
  return renderLayoutHtml(
    compiled.compiled,
    buildCustomActionLayoutScope({
      outputSchema: [{ id: "f", name: "Formula", type: "string", description: "" }],
      value: { Formula: formula },
      selection: "",
      targetCode: "en",
      status: "done",
    }),
    math ? { math } : {},
  )
}

describe("loadLayoutMath", () => {
  it("loads Temml once for every layout", async () => {
    const first = loadLayoutMath()
    expect(loadLayoutMath()).toBe(first)
    const math = await first
    expect(math.render("\\frac{1}{2}", false)).toContain("<math")
    expect(math.css).toContain("math")
  })

  it("draws the formulas written in text with the math filter", async () => {
    const html = render(
      '<p>{{ ["Formula"] | math }}</p>',
      "The area is \\(\\pi r^2\\).",
      await loadLayoutMath(),
    )
    expect(html).toContain("The area is ")
    expect(html).toContain("<math")
    expect(html).not.toContain("\\pi")
  })

  it("draws a whole value as one formula with the latex filter", async () => {
    const html = render('<p>{{ ["Formula"] | latex }}</p>', "\\frac{1}{2}", await loadLayoutMath())
    expect(html).toContain("<math")
    expect(html).not.toContain("\\frac")
  })

  // What a layout shows when nothing draws its formulas: their LaTeX source.
  it("is what turns a formula's source into a drawn formula", () => {
    const html = render('<p>{{ ["Formula"] | latex }}</p>', "\\frac{1}{2}")
    expect(html).not.toContain("<math")
    expect(html).toContain("\\frac{1}{2}")
  })
})
