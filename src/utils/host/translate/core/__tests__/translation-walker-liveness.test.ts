// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { WALKED_ATTRIBUTE } from "@/utils/constants/dom-labels"
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
  container.setAttribute("data-read-frog-paragraph", "")
  container.setAttribute("data-read-frog-block-node", "")
  for (let i = 0; i < childCount; i++) {
    const p = document.createElement("p")
    p.setAttribute(WALKED_ATTRIBUTE, "walk-1")
    p.setAttribute("data-read-frog-paragraph", "")
    p.setAttribute("data-read-frog-block-node", "")
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
})
