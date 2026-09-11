import type { GlossaryMerge } from "../merge-document"
import { describe, expect, it } from "vitest"
import { applyResolutions, isDestructive } from "../sync"

const T0 = new Date("2026-01-01T00:00:00.000Z")

function glossary(id: string, name: string) {
  return {
    id,
    name,
    description: "",
    enabled: true,
    matchPatterns: [],
    createdAt: T0,
    updatedAt: T0,
  }
}

function term(glossaryId: string, source: string, target: string) {
  return {
    id: `${glossaryId}-${source}`,
    glossaryId,
    matchKey: `i:${source.toLowerCase()}`,
    targetLang: "cmn",
    source,
    target,
    caseSensitive: false,
    enabled: true,
    updatedAt: T0,
  }
}

const EMPTY_STATS = { incoming: 0, outgoing: 0, removed: 0, unchanged: 0 }

function merge(partial: Partial<GlossaryMerge>): GlossaryMerge {
  return {
    glossaries: [],
    terms: [],
    conflicts: [],
    stats: {
      glossaries: { ...EMPTY_STATS },
      terms: { ...EMPTY_STATS },
      localRowsRemoved: 0,
      localRowsTotal: 0,
    },
    ...partial,
  }
}

describe("applyResolutions", () => {
  it("swaps in the side the user picked", () => {
    const local = term("g", "token", "令牌")
    const remote = term("g", "token", "代币")
    const key = "g cmn i:token"
    const result = applyResolutions(
      merge({
        terms: [remote],
        conflicts: [
          {
            level: "term",
            glossaryId: "g",
            conflict: { key, kind: "both-edited", local, remote, resolution: remote },
          },
        ],
      }),
      new Map([[key, "local"]]),
    )
    expect(result.terms.map((row) => row.target)).toEqual(["令牌"])
  })

  it("leaves a conflict the user did not answer at the merge's own choice", () => {
    const local = term("g", "token", "令牌")
    const remote = term("g", "token", "代币")
    const key = "g cmn i:token"
    const result = applyResolutions(
      merge({
        terms: [remote],
        conflicts: [
          {
            level: "term",
            glossaryId: "g",
            conflict: { key, kind: "both-edited", local, remote, resolution: remote },
          },
        ],
      }),
      new Map(),
    )
    expect(result.terms.map((row) => row.target)).toEqual(["代币"])
  })

  /**
   * The row was kept because a delete never wins by default. Choosing the side
   * that deleted it has to mean letting the delete through, not writing an
   * undefined row.
   */
  it("lets a delete through when the user picks the side that deleted", () => {
    const local = term("g", "token", "令牌")
    const key = "g cmn i:token"
    const result = applyResolutions(
      merge({
        terms: [local],
        conflicts: [
          {
            level: "term",
            glossaryId: "g",
            conflict: { key, kind: "edited-and-deleted", local, resolution: local },
          },
        ],
      }),
      new Map([[key, "remote"]]),
    )
    expect(result.terms).toEqual([])
  })

  /** Deleting a glossary here has to mean the same thing it means in the editor. */
  it("takes a glossary's terms with it when the glossary is resolved away", () => {
    const g = glossary("g", "Work")
    const result = applyResolutions(
      merge({
        glossaries: [g],
        terms: [term("g", "React", "反应"), term("other", "Go", "围棋")],
        conflicts: [
          {
            level: "glossary",
            conflict: { key: "g", kind: "edited-and-deleted", local: g, resolution: g },
          },
        ],
      }),
      new Map([["g", "remote"]]),
    )
    expect(result.glossaries).toEqual([])
    expect(result.terms.map((row) => row.glossaryId)).toEqual(["other"])
  })
})

describe("isDestructive", () => {
  it("says nothing about a merge that removes nothing", () => {
    expect(isDestructive(0, 20000)).toBe(false)
  })

  /** A percentage alone lets a small glossary vanish without a word. */
  it("catches a small list losing most of itself", () => {
    expect(isDestructive(3, 5)).toBe(true)
  })

  /** A count alone lets a 20,000-term library lose 3,000. */
  it("catches a large list losing a large share", () => {
    expect(isDestructive(51, 20000)).toBe(true)
    expect(isDestructive(10, 20000)).toBe(false)
  })
})
