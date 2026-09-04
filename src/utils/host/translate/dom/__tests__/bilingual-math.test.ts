// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { PRESERVED_MATH_CLASS } from "@/utils/constants/dom-labels"
import { protectBilingualMath } from "../bilingual-math"

function createParagraph(): HTMLElement {
  const paragraph = document.createElement("p")
  paragraph.innerHTML =
    'Starting from harness <math id="formula" class="ltx_Math" alttext="H_{0}" display="inline" onclick="evil()"><semantics><msub><mi id="symbol">H</mi><mn>0</mn></msub><annotation encoding="application/x-tex">H_{0}</annotation></semantics></math>, the protocol runs for <math alttext="T"><semantics><mi>T</mi><annotation encoding="application/x-tex">T</annotation></semantics></math> steps.'
  return paragraph
}

describe("bilingual MathML protection", () => {
  it("sends stable placeholders and renders cloned formulas in translated order", () => {
    const paragraph = createParagraph()
    const sourceMath = [...paragraph.querySelectorAll("math")]
    const protectedMath = protectBilingualMath([paragraph], DEFAULT_CONFIG)

    expect(protectedMath.filterText).toBe("Starting from harness , the protocol runs for  steps.")
    expect(protectedMath.requestText).toBe(
      "Starting from harness {{READ_FROG_MATH_0}}, the protocol runs for {{READ_FROG_MATH_1}} steps.",
    )

    const output = document.createElement("span")
    protectedMath.renderInto(
      output,
      "协议运行 {{READ_FROG_MATH_1}} 步，初始框架是 {{READ_FROG_MATH_0}}。",
    )

    const renderedMath = [...output.querySelectorAll("math")]
    expect(renderedMath).toHaveLength(2)
    expect(renderedMath[0]?.getAttribute("alttext")).toBe("T")
    expect(renderedMath[1]?.getAttribute("alttext")).toBe("H_{0}")
    expect(renderedMath[1]).not.toBe(sourceMath[0])
    expect(renderedMath[1]?.classList.contains(PRESERVED_MATH_CLASS)).toBe(true)
    expect(renderedMath[1]?.getAttribute("translate")).toBe("no")
    expect(renderedMath[1]?.hasAttribute("id")).toBe(false)
    expect(renderedMath[1]?.hasAttribute("onclick")).toBe(false)
    expect(renderedMath[1]?.querySelector("#symbol")).toBeNull()
    expect(sourceMath[0]?.getAttribute("id")).toBe("formula")
    expect(sourceMath[0]?.getAttribute("onclick")).toBe("evil()")
  })

  it("keeps formulas visible when a provider drops their placeholders", () => {
    const paragraph = createParagraph()
    const protectedMath = protectBilingualMath([paragraph], DEFAULT_CONFIG)
    const output = document.createElement("span")

    protectedMath.renderInto(output, "没有返回任何公式占位符。")

    expect(output.querySelectorAll("math")).toHaveLength(2)
    expect(output.textContent).toContain("没有返回任何公式占位符。")
  })

  it("chooses a collision-free marker stem deterministically", () => {
    const paragraph = createParagraph()
    paragraph.prepend("Literal {{ read_frog_math_0 }} marker. ")

    const protectedMath = protectBilingualMath([paragraph], DEFAULT_CONFIG)

    expect(protectedMath.requestText).toContain("{{ read_frog_math_0 }} marker")
    expect(protectedMath.requestText).toContain("{{READ_FROG_MATH_X_0}}")
    expect(protectedMath.requestText).toContain("{{READ_FROG_MATH_X_1}}")
  })
})
