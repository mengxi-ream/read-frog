// @vitest-environment jsdom
// Pairing logic for the translationOnly in-place text swap (issue #1846).

import type { TransNode } from "@/types/dom"
import { describe, expect, it } from "vitest"
import { planInPlaceTextSwap } from "../dom/translation-text-swap"

function buildRun(html: string): { container: HTMLElement; run: TransNode[] } {
  const container = document.createElement("div")
  container.innerHTML = html
  return { container, run: [...container.childNodes] as TransNode[] }
}

describe("planInPlaceTextSwap", () => {
  it("pairs a single bare text node with the whole translation (trivial path)", () => {
    const { run } = buildRun("Hello world")
    const plan = planInPlaceTextSwap(run, "你好世界", document)
    expect(plan).not.toBeNull()
    expect(plan!.pairs).toHaveLength(1)
    expect(plan!.pairs[0].node).toBe(run[0])
    expect(plan!.pairs[0].translatedValue).toBe("你好世界")
  })

  it("flattens hallucinated tags in the trivial path", () => {
    const { run } = buildRun("Hello world")
    const plan = planInPlaceTextSwap(run, "<div><b>你好</b>世界</div>", document)
    expect(plan).not.toBeNull()
    expect(plan!.pairs[0].translatedValue).toBe("你好世界")
  })

  it("aligns mixed text and inline elements structurally", () => {
    const { container, run } = buildRun('lead <a href="/x">link</a> tail')
    const plan = planInPlaceTextSwap(run, '前缀 <a href="/x">链接</a> 后缀', document)
    expect(plan).not.toBeNull()
    const valueFor = (node: Node) => plan!.pairs.find((pair) => pair.node === node)?.translatedValue
    expect(plan!.pairs).toHaveLength(3)
    expect(valueFor(container.childNodes[0])).toBe("前缀 ")
    expect(valueFor(container.childNodes[1].firstChild!)).toBe("链接")
    expect(valueFor(container.childNodes[2])).toBe(" 后缀")
  })

  it("merges provider-split gap text into the first source node and blanks the rest", () => {
    const container = document.createElement("div")
    const t1 = document.createTextNode("part one ")
    const t2 = document.createTextNode("part two")
    container.append(t1, document.createElement("br"), document.createTextNode("x"))
    container.insertBefore(t2, container.childNodes[1])
    // container: [t1, t2, <br>, "x"] — two source text nodes in one gap
    const run = [...container.childNodes] as TransNode[]
    const plan = planInPlaceTextSwap(run, "合并译文<br>甲", document)
    expect(plan).not.toBeNull()
    const gapPairs = plan!.pairs.filter((pair) => pair.node === t1 || pair.node === t2)
    expect(gapPairs.find((pair) => pair.node === t1)!.translatedValue).toBe("合并译文")
    expect(gapPairs.find((pair) => pair.node === t2)!.translatedValue).toBe("")
  })

  it("returns null when the provider drops an element", () => {
    const { run } = buildRun("lead <b>bold</b> tail")
    expect(planInPlaceTextSwap(run, "前缀 粗体 后缀", document)).toBeNull()
  })

  it("returns null when the provider changes an element's tag", () => {
    const { run } = buildRun("lead <b>bold</b> tail")
    expect(planInPlaceTextSwap(run, "前缀 <i>粗体</i> 后缀", document)).toBeNull()
  })

  it("returns null when translated text has no source slot (orphan target)", () => {
    const { run } = buildRun("<b>bold</b>")
    // Target adds loose text before the element where source had none
    expect(planInPlaceTextSwap(run, "多余 <b>粗体</b>", document)).toBeNull()
  })

  it("returns null when source text goes untranslated (uncovered gap)", () => {
    const { run } = buildRun("lead <b>bold</b> tail")
    expect(planInPlaceTextSwap(run, "<b>粗体</b>", document)).toBeNull()
  })

  it("collects translated human-visible attributes as attribute pairs", () => {
    const { container, run } = buildRun('<a href="/x" title="City">link</a> tail')
    const plan = planInPlaceTextSwap(run, '<a href="/x" title="城市">链接</a> 尾部', document)
    expect(plan).not.toBeNull()
    expect(plan!.attributePairs).toEqual([
      { element: container.children[0], name: "title", translatedValue: "城市" },
    ])
  })

  it("does not create attribute pairs when the target drops or keeps the attribute", () => {
    const { run } = buildRun('<a href="/x" title="City">link</a> tail')
    const plan = planInPlaceTextSwap(run, '<a href="/x">链接</a> 尾部', document)
    expect(plan).not.toBeNull()
    expect(plan!.attributePairs).toEqual([])
  })
})
