// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  CONTENT_WRAPPER_CLASS,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { createWorkPacer } from "@/utils/scheduler"
import { translateWalkedElement } from "../translation-walker"

const { mockTranslateNodes } = vi.hoisted(() => ({
  mockTranslateNodes: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("../translation-modes", () => ({
  translateNodes: mockTranslateNodes,
}))

vi.mock("../translation-state", () => ({
  getTranslationOnlyAnchorState: vi.fn<(...args: any[]) => any>().mockReturnValue(undefined),
}))

// Label a container as a paragraph tree: the container plus each child <p> is a
// paragraph, so translateWalkedElement recurses and calls translateNodes per unit.
function buildParagraphTree(childCount: number): HTMLElement {
  const container = document.createElement("div")
  container.setAttribute(WALKED_ATTRIBUTE, "walk-1")
  container.setAttribute(PARAGRAPH_ATTRIBUTE, "")
  container.setAttribute(BLOCK_ATTRIBUTE, "")
  for (let i = 0; i < childCount; i++) {
    const p = document.createElement("p")
    p.setAttribute(WALKED_ATTRIBUTE, "walk-1")
    p.setAttribute(PARAGRAPH_ATTRIBUTE, "")
    p.setAttribute(BLOCK_ATTRIBUTE, "")
    p.textContent = `paragraph ${i}`
    container.append(p)
  }
  document.body.append(container)
  return container
}

// The container has block children, so its loop emits empty translateNodes([])
// calls between block children (structural, not real work). Count only the
// real leaf-paragraph translations.
function realTranslationTexts(): string[] {
  return mockTranslateNodes.mock.calls
    .map((call) => call[0] as ChildNode[])
    .filter((nodes) => nodes.length > 0)
    .map((nodes) => nodes.map((n) => n.textContent).join(""))
    .filter((text) => text.startsWith("paragraph"))
}

describe("translateWalkedElement liveness", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    mockTranslateNodes.mockResolvedValue(undefined)
  })

  it("translates nothing when the session is already cancelled", async () => {
    const container = buildParagraphTree(6)
    const pacer = createWorkPacer(0)

    await translateWalkedElement(container, "walk-1", DEFAULT_CONFIG, false, pacer, () => false)

    expect(realTranslationTexts()).toHaveLength(0)
  })

  it("stops paced expansion once shouldContinue turns false mid-flight", async () => {
    const container = buildParagraphTree(6)
    // budgetMs 0 forces a yield (and a liveness check) at every recursive entry;
    // the checks fire in spawn order as each chain resumes from its yield.
    const pacer = createWorkPacer(0)

    // Simulate a cancel landing after the third liveness check.
    let checks = 0
    const shouldContinue = () => {
      checks += 1
      return checks <= 3
    }

    await translateWalkedElement(container, "walk-1", DEFAULT_CONFIG, false, pacer, shouldContinue)

    const translated = realTranslationTexts()
    // Without the gate all 6 children translate; with it, expansion halts as
    // soon as a resumed chain sees the cancel.
    expect(translated.length).toBeGreaterThan(0)
    expect(translated.length).toBeLessThan(6)
  })

  it("translates the whole tree when the session stays alive", async () => {
    const container = buildParagraphTree(4)
    const pacer = createWorkPacer(0)

    await translateWalkedElement(container, "walk-1", DEFAULT_CONFIG, false, pacer, () => true)

    expect(new Set(realTranslationTexts()).size).toBe(4)
  })

  it("translates only an explicit inline child run when a split block is already translated", async () => {
    const container = document.createElement("p")
    container.setAttribute(WALKED_ATTRIBUTE, "walk-1")
    container.setAttribute(PARAGRAPH_ATTRIBUTE, "")
    container.setAttribute(BLOCK_ATTRIBUTE, "")
    const before = document.createTextNode("Narration before. ")
    const dialogue = document.createElement("q")
    dialogue.setAttribute(WALKED_ATTRIBUTE, "walk-1")
    dialogue.setAttribute(PARAGRAPH_ATTRIBUTE, "")
    dialogue.setAttribute(INLINE_ATTRIBUTE, "")
    dialogue.textContent = '"Dialogue"'
    const after = document.createTextNode(" Narration after.")
    const block = document.createElement("p")
    block.setAttribute(WALKED_ATTRIBUTE, "walk-1")
    block.setAttribute(PARAGRAPH_ATTRIBUTE, "")
    block.setAttribute(BLOCK_ATTRIBUTE, "")
    block.textContent = "Block paragraph"
    const existingTranslation = document.createElement("span")
    existingTranslation.className = CONTENT_WRAPPER_CLASS
    block.append(existingTranslation)
    container.append(before, dialogue, after, block)
    document.body.append(container)

    const childRun = [before, dialogue, after]
    await translateWalkedElement(
      container,
      "walk-1",
      DEFAULT_CONFIG,
      false,
      createWorkPacer(),
      () => true,
      undefined,
      { childRuns: [childRun] },
    )

    expect(mockTranslateNodes).toHaveBeenCalledTimes(1)
    expect(mockTranslateNodes).toHaveBeenCalledWith(
      childRun,
      "walk-1",
      false,
      DEFAULT_CONFIG,
      true,
      undefined,
    )
  })
})
