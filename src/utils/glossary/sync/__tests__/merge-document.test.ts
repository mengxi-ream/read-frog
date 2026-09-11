import type { SyncedGlossary, SyncedTerm } from "../document"
import { describe, expect, it } from "vitest"
import { MAX_GLOSSARIES, MAX_GLOSSARY_TERMS } from "@/utils/constants/glossary"
import { mergeGlossaryDocuments } from "../merge-document"

const T0 = new Date("2026-01-01T00:00:00.000Z")
const T1 = new Date("2026-02-01T00:00:00.000Z")
const T2 = new Date("2026-03-01T00:00:00.000Z")

function glossary(id: string, overrides: Partial<SyncedGlossary> = {}): SyncedGlossary {
  return {
    id,
    name: id,
    description: "",
    enabled: true,
    matchPatterns: [],
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  }
}

function term(glossaryId: string, source: string, overrides: Partial<SyncedTerm> = {}): SyncedTerm {
  return {
    // Deliberately derived from the source rather than random: every assertion
    // below is about identity, and a uuid that happened to match would hide a
    // merge keyed on the wrong thing.
    id: `${glossaryId}-${source}`,
    glossaryId,
    matchKey: `i:${source.toLowerCase()}`,
    targetLang: "cmn",
    source,
    target: `${source}-译`,
    caseSensitive: false,
    enabled: true,
    updatedAt: T0,
    ...overrides,
  }
}

interface Snapshot {
  glossaries: SyncedGlossary[]
  terms: SyncedTerm[]
}

function snapshot(glossaries: SyncedGlossary[], terms: SyncedTerm[] = []): Snapshot {
  return { glossaries, terms }
}

function merge(base: Snapshot, local: Snapshot, remote: Snapshot) {
  const result = mergeGlossaryDocuments({ base, local, remote })
  if (!result.ok) throw new Error(`merge refused: ${result.reason}`)
  return result.merge
}

function wordings(terms: readonly SyncedTerm[]): string[] {
  return terms
    .map((t) => `${t.glossaryId}/${t.source}=>${t.target}${t.enabled ? "" : " (off)"}`)
    .sort()
}

// ---------------------------------------------------------------------------
// The case matrix, at the level a row can be added or deleted
// ---------------------------------------------------------------------------

describe("mergeGlossaryDocuments — one side has a row and the other does not", () => {
  const g = glossary("g")
  const base = snapshot([g])

  it("keeps a row this device added", () => {
    const added = term("g", "React")
    const merged = merge(base, snapshot([g], [added]), snapshot([g]))
    expect(wordings(merged.terms)).toEqual(["g/React=>React-译"])
  })

  it("keeps a row the cloud added", () => {
    const added = term("g", "React")
    const merged = merge(base, snapshot([g]), snapshot([g], [added]))
    expect(wordings(merged.terms)).toEqual(["g/React=>React-译"])
  })

  /**
   * The case a sync without a merge base cannot get right. "This device has it,
   * the cloud does not" is the same shape whether it was just added here or
   * deleted there, and guessing loses data in one of the two.
   */
  it("propagates a delete the cloud made, rather than re-uploading the row", () => {
    const existing = term("g", "React")
    const merged = merge(snapshot([g], [existing]), snapshot([g], [existing]), snapshot([g]))
    expect(merged.terms).toEqual([])
    expect(merged.stats.terms.removed).toBe(1)
  })

  it("propagates a delete this device made", () => {
    const existing = term("g", "React")
    const merged = merge(snapshot([g], [existing]), snapshot([g]), snapshot([g], [existing]))
    expect(merged.terms).toEqual([])
  })

  it("drops a row both sides deleted, without calling it a conflict", () => {
    const existing = term("g", "React")
    const merged = merge(snapshot([g], [existing]), snapshot([g]), snapshot([g]))
    expect(merged.terms).toEqual([])
    expect(merged.conflicts).toEqual([])
  })

  /**
   * Asymmetry decides this one: an unwanted row costs a click to delete again,
   * a deleted wording the user typed is gone for good.
   */
  it("keeps a row one side edited and the other deleted, and reports it", () => {
    const before = term("g", "React")
    const edited = { ...before, target: "反应", updatedAt: T1 }
    const merged = merge(snapshot([g], [before]), snapshot([g], [edited]), snapshot([g]))
    expect(wordings(merged.terms)).toEqual(["g/React=>反应"])
    expect(merged.conflicts).toHaveLength(1)
    expect(merged.conflicts[0]).toMatchObject({
      level: "term",
      conflict: { kind: "edited-and-deleted" },
    })
  })
})

describe("mergeGlossaryDocuments — both sides have the row", () => {
  const g = glossary("g")

  it("leaves an untouched row alone", () => {
    const row = term("g", "React")
    const merged = merge(snapshot([g], [row]), snapshot([g], [row]), snapshot([g], [row]))
    expect(wordings(merged.terms)).toEqual(["g/React=>React-译"])
    expect(merged.stats.terms.unchanged).toBe(1)
    expect(merged.conflicts).toEqual([])
  })

  it("takes the side that changed, when only one did", () => {
    const before = term("g", "React")
    const local = { ...before, target: "反应", updatedAt: T1 }
    const remote = { ...before, target: "リアクト", updatedAt: T1 }

    expect(
      wordings(
        merge(snapshot([g], [before]), snapshot([g], [local]), snapshot([g], [before])).terms,
      ),
    ).toEqual(["g/React=>反应"])
    expect(
      wordings(
        merge(snapshot([g], [before]), snapshot([g], [before]), snapshot([g], [remote])).terms,
      ),
    ).toEqual(["g/React=>リアクト"])
  })

  it("is not a conflict when both sides made the same edit", () => {
    const before = term("g", "React")
    const edited = { ...before, target: "反应", updatedAt: T1 }
    const merged = merge(snapshot([g], [before]), snapshot([g], [edited]), snapshot([g], [edited]))
    expect(merged.conflicts).toEqual([])
    expect(wordings(merged.terms)).toEqual(["g/React=>反应"])
  })

  /**
   * The everyday case, and the reason the merge is per field rather than per
   * row: turning a term off on one machine and rewording it on the other are
   * both wanted, and nobody should have to choose between them.
   */
  it("applies edits to different fields of the same row without asking", () => {
    const before = term("g", "React")
    const local = { ...before, enabled: false, updatedAt: T1 }
    const remote = { ...before, target: "反应", updatedAt: T1 }
    const merged = merge(snapshot([g], [before]), snapshot([g], [local]), snapshot([g], [remote]))
    expect(wordings(merged.terms)).toEqual(["g/React=>反应 (off)"])
    expect(merged.conflicts).toEqual([])
  })

  it("reports a real disagreement, and defaults to the newer edit", () => {
    const before = term("g", "React")
    const local = { ...before, target: "反应", updatedAt: T1 }
    const remote = { ...before, target: "리액트", updatedAt: T2 }
    const merged = merge(snapshot([g], [before]), snapshot([g], [local]), snapshot([g], [remote]))
    expect(wordings(merged.terms)).toEqual(["g/React=>리액트"])
    expect(merged.conflicts).toHaveLength(1)
    expect(merged.conflicts[0]).toMatchObject({ conflict: { kind: "both-edited" } })
  })

  /**
   * Every user's first sync is "I already have terms on both machines", and a
   * uuid-keyed merge would carry both copies into one glossary — where the
   * unique index rejects the write, after part of the batch has committed.
   */
  it("treats the same term typed on both devices as one row, not two", () => {
    const local = term("g", "token", { id: "uuid-from-laptop" })
    const remote = term("g", "token", { id: "uuid-from-desktop" })
    const merged = merge(snapshot([g]), snapshot([g], [local]), snapshot([g], [remote]))
    expect(merged.terms).toHaveLength(1)
    expect(merged.conflicts).toEqual([])
  })

  it("calls it out when the same term was typed on both devices with different wordings", () => {
    const local = term("g", "token", { id: "a", target: "令牌", updatedAt: T1 })
    const remote = term("g", "token", { id: "b", target: "代币", updatedAt: T2 })
    const merged = merge(snapshot([g]), snapshot([g], [local]), snapshot([g], [remote]))
    expect(merged.terms).toHaveLength(1)
    expect(wordings(merged.terms)).toEqual(["g/token=>代币"])
    expect(merged.conflicts[0]).toMatchObject({ conflict: { kind: "both-added" } })
  })

  it("keeps a term filed under a different language as a different row", () => {
    const cmn = term("g", "Go", { id: "a", targetLang: "cmn", target: "围棋" })
    const jpn = term("g", "Go", { id: "b", targetLang: "jpn", target: "囲碁" })
    const merged = merge(snapshot([g]), snapshot([g], [cmn]), snapshot([g], [jpn]))
    expect(merged.terms).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// The glossary level, and what it does to the terms below it
// ---------------------------------------------------------------------------

describe("mergeGlossaryDocuments — glossaries", () => {
  it("unions two glossaries created independently rather than guessing they are one", () => {
    const mine = glossary("laptop-uuid", { name: "Work" })
    const theirs = glossary("desktop-uuid", { name: "Work" })
    const merged = merge(snapshot([]), snapshot([mine]), snapshot([theirs]))
    expect(merged.glossaries.map((g) => g.id).sort()).toEqual(["desktop-uuid", "laptop-uuid"])
  })

  /**
   * The website list is a set, so two devices adding different sites is a union.
   * Treating it as one opaque value — which is what the config sync does with
   * every array — would make the user throw one device's additions away.
   */
  it("unions the website lists, and still propagates a removal", () => {
    const before = glossary("g", { matchPatterns: ["*.a.com", "*.b.com"] })
    const local = { ...before, matchPatterns: ["*.a.com", "*.b.com", "*.local.com"], updatedAt: T1 }
    const remote = { ...before, matchPatterns: ["*.a.com", "*.remote.com"], updatedAt: T1 }
    const merged = merge(snapshot([before]), snapshot([local]), snapshot([remote]))
    expect(merged.glossaries[0]?.matchPatterns.sort()).toEqual([
      "*.a.com",
      "*.local.com",
      "*.remote.com",
    ])
  })

  it("deletes a glossary and everything in it when nobody objects", () => {
    const g = glossary("g")
    const rows = [term("g", "React"), term("g", "Go")]
    const merged = merge(snapshot([g], rows), snapshot([g], rows), snapshot([]))
    expect(merged.glossaries).toEqual([])
    expect(merged.terms).toEqual([])
  })

  /**
   * The failure this rule exists for. Per-row reasoning keeps the edited term
   * "to be safe" while the glossary goes — and `loadGlossaryEntries` starts from
   * the glossaries, so that term is then unreachable from every screen and every
   * prompt while still counting against the 20,000 cap. Both devices report
   * success.
   */
  it("resurrects a glossary the other side deleted, WITH the terms nobody edited", () => {
    const g = glossary("g")
    const untouched = term("g", "Go")
    const before = term("g", "React")
    const edited = { ...before, target: "反应", updatedAt: T1 }

    const merged = merge(
      snapshot([g], [untouched, before]),
      snapshot([g], [untouched, edited]),
      snapshot([]),
    )

    expect(merged.glossaries.map((glossaryRow) => glossaryRow.id)).toEqual(["g"])
    expect(wordings(merged.terms)).toEqual(["g/Go=>Go-译", "g/React=>反应"])
    expect(merged.conflicts).toHaveLength(1)
    expect(merged.conflicts[0]).toMatchObject({
      level: "glossary",
      conflict: { kind: "edited-and-deleted" },
    })
  })

  it("resurrects it for a term ADDED on the surviving side too", () => {
    const g = glossary("g")
    const existing = term("g", "Go")
    const merged = merge(
      snapshot([g], [existing]),
      snapshot([g], [existing, term("g", "React")]),
      snapshot([]),
    )
    expect(merged.glossaries).toHaveLength(1)
    expect(wordings(merged.terms)).toEqual(["g/Go=>Go-译", "g/React=>React-译"])
  })

  it("never returns a term whose glossary is gone", () => {
    const g = glossary("g")
    const rows = [term("g", "React"), term("g", "Go")]
    for (const merged of [
      merge(snapshot([g], rows), snapshot([g], rows), snapshot([])),
      merge(snapshot([g], rows), snapshot([]), snapshot([g], rows)),
      merge(snapshot([g], rows), snapshot([]), snapshot([])),
    ]) {
      const ids = new Set(merged.glossaries.map((glossaryRow) => glossaryRow.id))
      expect(merged.terms.every((row) => ids.has(row.glossaryId))).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

describe("mergeGlossaryDocuments — the caps, at the union", () => {
  /**
   * Refused whole, with the number, rather than truncated: a half-applied merge
   * is a glossary the user cannot audit, and this is the one table in the
   * product holding text they typed.
   */
  it("refuses a merge that would exceed the term cap, and says by how much", () => {
    const g = glossary("g")
    const half = Math.ceil(MAX_GLOSSARY_TERMS / 2) + 5
    const localRows = Array.from({ length: half }, (_, i) => term("g", `local-${i}`))
    const remoteRows = Array.from({ length: half }, (_, i) => term("g", `remote-${i}`))

    const result = mergeGlossaryDocuments({
      base: snapshot([g]),
      local: snapshot([g], localRows),
      remote: snapshot([g], remoteRows),
    })

    expect(result).toEqual({
      ok: false,
      reason: "termCapExceeded",
      overflowBy: half * 2 - MAX_GLOSSARY_TERMS,
    })
  })

  it("refuses a merge that would exceed the glossary cap", () => {
    const locals = Array.from({ length: MAX_GLOSSARIES }, (_, i) => glossary(`local-${i}`))
    const remotes = Array.from({ length: 3 }, (_, i) => glossary(`remote-${i}`))
    const result = mergeGlossaryDocuments({
      base: snapshot([]),
      local: snapshot(locals),
      remote: snapshot(remotes),
    })
    expect(result).toEqual({ ok: false, reason: "glossaryCapExceeded", overflowBy: 3 })
  })
})

describe("mergeGlossaryDocuments — what the destructive gate reads", () => {
  it("counts the rows this device would lose", () => {
    const g = glossary("g")
    const rows = [term("g", "a"), term("g", "b"), term("g", "c")]
    const merged = merge(snapshot([g], rows), snapshot([g], rows), snapshot([g], rows.slice(0, 1)))
    expect(merged.stats.localRowsRemoved).toBe(2)
    expect(merged.stats.localRowsTotal).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// Ways the merge could hand the writer something it cannot store, or quietly
// drop what only this device had
// ---------------------------------------------------------------------------

describe("mergeGlossaryDocuments — what the writer receives", () => {
  /**
   * `bulkPut` keys on the uuid, so two rows carrying one uuid means the second
   * silently replaces the first — and the NEXT sync reads the vanished identity
   * as a deletion to propagate. Identity is the triple; the uuid is only this
   * device's storage key, so the loser may safely be renumbered.
   */
  it("gives every term its own primary key when one row was reworded on both", () => {
    const g = glossary("g")
    const before = term("g", "token")
    // The same row, id and all, renamed differently on each device.
    const mine = { ...before, id: before.id, source: "alpha", matchKey: "i:alpha", updatedAt: T1 }
    const theirs = { ...before, id: before.id, source: "beta", matchKey: "i:beta", updatedAt: T1 }

    const merged = merge(snapshot([g], [before]), snapshot([g], [mine]), snapshot([g], [theirs]))

    expect(merged.terms.map((t) => t.source).sort()).toEqual(["alpha", "beta"])
    expect(new Set(merged.terms.map((t) => t.id)).size).toBe(merged.terms.length)
  })

  it("keeps the untouched rows' ids exactly as they were", () => {
    const g = glossary("g")
    const mine = term("g", "token")
    const merged = merge(snapshot([g], [mine]), snapshot([g], [mine]), snapshot([g], [mine]))
    expect(merged.terms.map((t) => t.id)).toEqual([mine.id])
  })

  /**
   * No base for the row means nobody ever agreed this list, so the empty set is
   * the only honest ancestor. Reading local's own list as the base instead made
   * every site only this device had look like one the cloud deleted — dropped
   * without a conflict, without a count, and then uploaded.
   */
  it("unions the website lists when the same glossary has no base", () => {
    const mine = glossary("g", { matchPatterns: ["example.com", "mine.com"] })
    const theirs = glossary("g", { matchPatterns: ["example.com", "theirs.com"] })

    const merged = merge(snapshot([]), snapshot([mine]), snapshot([theirs]))

    expect(merged.glossaries[0]!.matchPatterns.sort()).toEqual([
      "example.com",
      "mine.com",
      "theirs.com",
    ])
  })
})

describe("mergeGlossaryDocuments — the timestamps a merged row carries", () => {
  /**
   * A row built on `local` keeps this device's older stamp even when it took the
   * wording from the cloud. The two then hold the same text under different
   * stamps forever: the next sync sees content-equal rows, says "unchanged" and
   * never uploads, while `preferNewer` keeps consulting the stamp first.
   */
  it("takes the newer stamp when it takes the newer wording", () => {
    const g = glossary("g")
    const before = term("g", "token", { target: "旧", updatedAt: T0 })
    const mine = term("g", "token", { target: "我的", updatedAt: T1 })
    const theirs = term("g", "token", { target: "他们的", updatedAt: T2 })

    const merged = merge(snapshot([g], [before]), snapshot([g], [mine]), snapshot([g], [theirs]))

    expect(merged.terms[0]!.target).toBe("他们的")
    expect(merged.terms[0]!.updatedAt).toEqual(T2)
  })

  it("agrees on the stamp whichever device runs the merge", () => {
    const g = glossary("g")
    const before = term("g", "token", { target: "旧", updatedAt: T0 })
    const mine = term("g", "token", { target: "我的", updatedAt: T1 })
    const theirs = term("g", "token", { target: "他们的", updatedAt: T2 })

    const here = merge(snapshot([g], [before]), snapshot([g], [mine]), snapshot([g], [theirs]))
    const there = merge(snapshot([g], [before]), snapshot([g], [theirs]), snapshot([g], [mine]))

    expect(here.terms[0]!.updatedAt).toEqual(there.terms[0]!.updatedAt)
    expect(here.terms[0]!.target).toBe(there.terms[0]!.target)
  })

  /** A glossary was created once; two devices holding it means it was copied. */
  it("keeps the earlier creation time on a glossary both sides changed", () => {
    const mine = glossary("g", { name: "Mine", createdAt: T1, updatedAt: T1 })
    const theirs = glossary("g", { name: "Theirs", createdAt: T2, updatedAt: T2 })

    const merged = merge(snapshot([]), snapshot([mine]), snapshot([theirs]))

    expect(merged.glossaries[0]!.createdAt).toEqual(T1)
  })
})
