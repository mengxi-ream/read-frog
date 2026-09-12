import type { GlossaryMerge } from "../merge-document"
import { describe, expect, it } from "vitest"
import { mergeGlossaryDocuments, termIdentity, withDistinctIds } from "../merge-document"
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
    const key = termIdentity(local)
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
    const key = termIdentity(local)
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
    const key = termIdentity(local)
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

/**
 * The keys above are built with `termIdentity` on purpose. Spelling them out by
 * hand is what let `applyResolutions` drift onto a second, differently
 * separated key builder while these tests stayed green: `set` added a row
 * instead of replacing one, `delete` matched nothing, and both passed because
 * the fixture agreed with the bug. This closes the loop through the real merge.
 */
describe("applyResolutions — against keys the merge actually produced", () => {
  const T = new Date("2026-01-01T00:00:00.000Z")
  const g = {
    id: "g",
    name: "W",
    description: "",
    enabled: true,
    matchPatterns: [] as string[],
    createdAt: T,
    updatedAt: T,
  }
  const row = (id: string, target: string, updatedAt: Date) => ({
    id,
    glossaryId: "g",
    matchKey: "i:token",
    targetLang: "cmn",
    source: "token",
    target,
    caseSensitive: false,
    enabled: true,
    updatedAt,
  })

  function realConflict() {
    const T1 = new Date("2026-01-02T00:00:00.000Z")
    const result = mergeGlossaryDocuments({
      base: { glossaries: [g], terms: [row("t1", "base", T)] },
      local: { glossaries: [g], terms: [row("t1", "local", T1)] },
      // A different uuid for the same term, which is what two devices that each
      // typed it hold — and what makes a duplicated row unstorable.
      remote: { glossaries: [g], terms: [row("t2", "remote", T1)] },
    })
    if (!result.ok) throw new Error("merge refused")
    expect(result.merge.conflicts).toHaveLength(1)
    return result.merge
  }

  it("replaces the row rather than adding a second one for the same term", () => {
    const merged = realConflict()
    const key = merged.conflicts[0]!.conflict.key

    const resolved = applyResolutions(merged, new Map([[key, "remote"]]))

    expect(resolved.terms).toHaveLength(1)
    expect(resolved.terms[0]!.target).toBe("remote")
  })

  it("does not leave two rows sharing one unique triple", () => {
    const merged = realConflict()
    const key = merged.conflicts[0]!.conflict.key

    const resolved = applyResolutions(merged, new Map([[key, "remote"]]))

    const triples = resolved.terms.map((t) => termIdentity(t))
    expect(new Set(triples).size).toBe(triples.length)
  })

  it("counts the rows a resolution removes towards the destructive gate", () => {
    const local = { ...row("t1", "mine", T), matchKey: "i:token" }
    const merged: GlossaryMerge = {
      glossaries: [g],
      terms: [local],
      conflicts: [
        {
          level: "term",
          glossaryId: "g",
          conflict: {
            key: termIdentity(local),
            kind: "edited-and-deleted",
            local,
            resolution: local,
          },
        },
      ],
      stats: {
        glossaries: { ...EMPTY_STATS },
        terms: { ...EMPTY_STATS },
        localRowsRemoved: 0,
        localRowsTotal: 2,
      },
    }

    const resolved = applyResolutions(merged, new Map([[termIdentity(local), "remote"]]))

    expect(resolved.terms).toEqual([])
    expect(resolved.stats.localRowsRemoved).toBe(1)
  })
})

/**
 * Two ways a resolution used to undo what the merge had established, both
 * between the dialog closing and the payload being written.
 */
describe("applyResolutions — what it must not undo", () => {
  const T = new Date("2026-01-01T00:00:00.000Z")
  const T1 = new Date("2026-01-02T00:00:00.000Z")
  const gl = (id: string, matchPatterns: string[] = []) => ({
    id,
    name: id,
    description: "",
    enabled: true,
    matchPatterns,
    createdAt: T,
    updatedAt: T,
  })
  const tm = (id: string, matchKey: string, target: string, updatedAt = T) => ({
    id,
    glossaryId: "g",
    matchKey,
    targetLang: "cmn",
    source: matchKey.slice(2),
    target,
    caseSensitive: false,
    enabled: true,
    updatedAt,
  })

  /**
   * The chosen row carries its OWN uuid, which `withDistinctIds` had already
   * renumbered away from inside the merge. Swapping it back in restores the
   * collision — and this one is invisible to the unique index, because the two
   * rows still have different identity triples. `bulkPut` keeps the last, the
   * base claims both, and the next sync deletes the survivor everywhere.
   */
  it("never emits two terms sharing a Dexie primary key", () => {
    const merged = mergeGlossaryDocuments({
      // A first sync: no base, so the same term on both sides is "both-added".
      base: { glossaries: [], terms: [] },
      local: { glossaries: [gl("g")], terms: [tm("x", "i:a", "L"), tm("y", "i:b", "Lb")] },
      // Shares uuid `y` with a DIFFERENT term of local's — what an export/import
      // round trip or any previous sync leaves behind.
      remote: { glossaries: [gl("g")], terms: [tm("y", "i:a", "R")] },
    })
    if (!merged.ok) throw new Error("merge refused")
    expect(merged.merge.conflicts).toHaveLength(1)

    const key = merged.merge.conflicts[0]!.conflict.key
    const resolved = applyResolutions(merged.merge, new Map([[key, "remote"]]))

    const ids = resolved.terms.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(resolved.terms.map((t) => termIdentity(t))).size).toBe(resolved.terms.length)
  })

  /** The dialog offers a name. It must not also revert the website list. */
  it("keeps the merged website list when the user picks a glossary's name", () => {
    const merged = mergeGlossaryDocuments({
      base: { glossaries: [], terms: [] },
      local: { glossaries: [{ ...gl("g", ["mine.com"]), name: "Mine", updatedAt: T1 }], terms: [] },
      remote: { glossaries: [{ ...gl("g", ["theirs.com"]), name: "Theirs" }], terms: [] },
    })
    if (!merged.ok) throw new Error("merge refused")
    const key = merged.merge.conflicts[0]!.conflict.key

    const resolved = applyResolutions(merged.merge, new Map([[key, "remote"]]))

    expect(resolved.glossaries[0]!.name).toBe("Theirs")
    expect(resolved.glossaries[0]!.matchPatterns.sort()).toEqual(["mine.com", "theirs.com"])
  })

  /**
   * Honouring this device's own delete of a glossary the cloud edited costs the
   * device nothing — it already does not have those rows. Differencing output
   * lengths counted the cloud's entire copy, and the clamp then announced it as
   * the whole local library.
   */
  it("does not count a declined incoming glossary as rows this device loses", () => {
    // `g` is the cloud's, and big. `h` is this device's, and small — so the
    // clamp cannot hide an over-count behind a zero total.
    const cloudTerms = Array.from({ length: 40 }, (_, i) => ({
      ...tm(`r${i}`, `i:r${i}`, "x"),
      glossaryId: "g",
    }))
    const mine = Array.from({ length: 3 }, (_, i) => ({
      ...tm(`m${i}`, `i:m${i}`, "x"),
      glossaryId: "h",
    }))
    const merged = mergeGlossaryDocuments({
      base: { glossaries: [gl("g"), gl("h")], terms: [...cloudTerms, ...mine] },
      // This device deleted `g` and everything in it, and kept `h`.
      local: { glossaries: [gl("h")], terms: mine },
      // The cloud renamed `g`, so the merge brings it back and asks.
      remote: {
        glossaries: [{ ...gl("g"), name: "Renamed", updatedAt: T1 }, gl("h")],
        terms: [...cloudTerms, ...mine],
      },
    })
    if (!merged.ok) throw new Error("merge refused")
    const glossaryConflict = merged.merge.conflicts.find((c) => c.level === "glossary")
    expect(glossaryConflict).toBeDefined()
    expect(merged.merge.stats.localRowsTotal).toBe(4)

    const resolved = applyResolutions(
      merged.merge,
      // "This device" — the side that deleted it.
      new Map([[glossaryConflict!.conflict.key, "local"]]),
    )

    // `h` and its three terms survive untouched; the device loses nothing.
    expect(resolved.glossaries.map((row) => row.id)).toEqual(["h"])
    expect(resolved.terms).toHaveLength(3)
    expect(resolved.stats.localRowsRemoved).toBe(0)
    expect(isDestructive(resolved.stats.localRowsRemoved, resolved.stats.localRowsTotal)).toBe(
      false,
    )
  })

  /** But a glossary this device DID hold, resolved away, is a real loss. */
  it("counts a glossary this device held when the user lets the delete through", () => {
    const mine = Array.from({ length: 5 }, (_, i) => tm(`m${i}`, `i:m${i}`, "x"))
    const merged = mergeGlossaryDocuments({
      base: { glossaries: [gl("g")], terms: mine },
      local: { glossaries: [{ ...gl("g"), name: "Edited", updatedAt: T1 }], terms: mine },
      // The cloud deleted it while this device was renaming it.
      remote: { glossaries: [], terms: [] },
    })
    if (!merged.ok) throw new Error("merge refused")
    const glossaryConflict = merged.merge.conflicts.find((c) => c.level === "glossary")!

    const resolved = applyResolutions(
      merged.merge,
      new Map([[glossaryConflict.conflict.key, "remote"]]),
    )

    expect(resolved.glossaries).toEqual([])
    expect(resolved.stats.localRowsRemoved).toBe(6)
  })
})

/**
 * The two dedupes `replaceGlossary` runs before it writes, kept honest here
 * because the write itself needs Dexie. Both exist so the rows on disk match
 * the `fingerprintAfter` recorded alongside them — otherwise the import's Undo
 * compares against a state that never existed and refuses forever.
 */
describe("what an imported document must be reduced to before it is stored", () => {
  const T = new Date("2026-01-01T00:00:00.000Z")
  const gl = (id: string, name: string) => ({
    id,
    name,
    description: "",
    enabled: true,
    matchPatterns: [] as string[],
    createdAt: T,
    updatedAt: T,
  })
  const tm = (id: string, matchKey: string) => ({
    id,
    glossaryId: "g",
    matchKey,
    targetLang: "cmn",
    source: matchKey.slice(2),
    target: "x",
    caseSensitive: false,
    enabled: true,
    updatedAt: T,
  })

  /** `bulkPut` keeps the last of a duplicated primary key; the count must agree. */
  it("collapses glossaries sharing an id, last one winning", () => {
    const rows = [gl("g", "first"), gl("g", "second"), gl("h", "other")]
    const deduped = [...new Map(rows.map((row) => [row.id, row])).values()]
    expect(deduped.map((row) => row.id)).toEqual(["g", "h"])
    expect(deduped.find((row) => row.id === "g")?.name).toBe("second")
  })

  /** And the unique index rejects two rows under one identity triple. */
  it("collapses terms sharing an identity, then separates their primary keys", () => {
    const rows = [tm("a", "i:token"), tm("b", "i:token"), tm("a", "i:widget")]
    const byIdentity = [...new Map(rows.map((row) => [termIdentity(row), row])).values()]
    expect(byIdentity).toHaveLength(2)
    const ids = withDistinctIds(byIdentity).map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
