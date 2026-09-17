import type { SyncedGlossary, SyncedTerm } from "./document"
import type { RowConflict, SetMergeStats, Side, Triple } from "./merge"
import { MAX_GLOSSARIES, MAX_GLOSSARY_TERMS } from "@/utils/constants/glossary"
import { fieldwiseMerge, mergeSets, mergeStringSet } from "./merge"

/** A glossary is the same glossary on two devices when it has the same id, and only then. */
function glossaryIdentity(glossary: SyncedGlossary): string {
  return glossary.id
}

/**
 * A term's identity across devices is the triple the database already enforces
 * as unique: which glossary, which target language, which match key.
 *
 * NOT the uuid. Two devices that each typed `token` hold two uuids for one term,
 * and merging on the uuid would carry both into one glossary — which the unique
 * index then rejects, aborting the write after Dexie has already committed part
 * of the batch. Merging on what the database calls unique means the collision
 * cannot be constructed.
 *
 * Exported because every caller that keys terms by identity — `applyResolutions`
 * matching the user's answers against the rows they were asked about — must use
 * THIS function. A second one written to look the same silently disagrees.
 */
export function termIdentity(term: SyncedTerm): string {
  return `${term.glossaryId}\u0000${term.targetLang}\u0000${term.matchKey}`
}

const GLOSSARY_FIELDS = ["name", "description", "enabled"] as const
const TERM_FIELDS = ["source", "target", "enabled"] as const

function glossaryContent(glossary: SyncedGlossary): string {
  return JSON.stringify([
    glossary.name,
    glossary.description,
    glossary.enabled,
    [...glossary.matchPatterns].sort(),
  ])
}

function termContent(term: SyncedTerm): string {
  return JSON.stringify([term.source, term.target, term.enabled])
}

function glossaryEqual(a: SyncedGlossary, b: SyncedGlossary): boolean {
  return glossaryContent(a) === glossaryContent(b)
}

function termEqual(a: SyncedTerm, b: SyncedTerm): boolean {
  return termContent(a) === termContent(b)
}

/**
 * The timestamps a merged row carries.
 *
 * `fieldwiseMerge` builds its result on `local`, so without this a row that took
 * its wording from the cloud keeps THIS device's older `updatedAt`. The two
 * devices then hold the same text under different timestamps forever: the next
 * sync sees content-equal rows, reports "unchanged" and never uploads, so
 * nothing ever reconciles them — while `preferNewer` keeps consulting the stamp
 * first and hands every future conflict on that row to whichever device happens
 * to hold the higher one.
 *
 * Both sides compute the same pair, so the two converge on the same values.
 */
function later(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}

/** A glossary was created once; two devices holding it means it was copied. */
function earlier(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

/**
 * Which of two versions of a row wins a field they both changed.
 *
 * Newer edit first, then a comparison of the two rows' own content. Both halves
 * are symmetric — neither asks which device it is running on — because a rule
 * that preferred "mine" would have the two devices overwrite each other forever.
 *
 * The content tie-break is not decoration: a CSV import stamps hundreds of rows
 * with the same millisecond, and without it the two devices pick different
 * winners for each of them and never converge.
 */
function preferNewer<V>(
  updatedAt: (row: V) => Date,
  content: (row: V) => string,
): (local: V, remote: V) => Side {
  return (local, remote) => {
    const l = updatedAt(local).getTime()
    const r = updatedAt(remote).getTime()
    if (l !== r) return l > r ? "local" : "remote"
    return content(local) <= content(remote) ? "local" : "remote"
  }
}

const mergeGlossaryFields = fieldwiseMerge<SyncedGlossary>({
  fields: GLOSSARY_FIELDS,
  prefer: preferNewer((glossary) => glossary.updatedAt, glossaryContent),
})

const mergeTermFields = fieldwiseMerge<SyncedTerm>({
  fields: TERM_FIELDS,
  prefer: preferNewer((term) => term.updatedAt, termContent),
})

export type GlossaryConflict =
  | { level: "glossary"; conflict: RowConflict<SyncedGlossary> }
  | { level: "term"; glossaryId: string; conflict: RowConflict<SyncedTerm> }

export interface GlossaryMergeStats {
  glossaries: SetMergeStats
  terms: SetMergeStats
  /**
   * How many rows this device holds that the merge would drop. What the
   * destructive-merge gate is measured against — every catastrophic path found
   * in review ends in "and then it deleted everything".
   */
  localRowsRemoved: number
  localRowsTotal: number
}

export interface GlossaryMerge {
  glossaries: SyncedGlossary[]
  terms: SyncedTerm[]
  conflicts: GlossaryConflict[]
  stats: GlossaryMergeStats
}

export type MergeGlossaryDocumentsResult =
  | { ok: true; merge: GlossaryMerge }
  | { ok: false; reason: "termCapExceeded" | "glossaryCapExceeded"; overflowBy: number }

export interface GlossarySnapshot {
  glossaries: readonly SyncedGlossary[]
  terms: readonly SyncedTerm[]
}

/** What a sync did to the rows on THIS device. */
export interface GlossaryChangeCounts {
  added: number
  updated: number
  removed: number
}

/**
 * The three numbers the toast reports, taken from the rows rather than from the
 * merge's own stats.
 *
 * `incoming`/`outgoing` answer "which direction did this row move", which is the
 * merge's question, not the user's: a sync that only propagated deletions counts
 * zero in both and reads as though nothing happened. These answer "what is in my
 * glossary now that was not before", which is the question someone clicking Sync
 * is actually asking, and it names deletions out loud.
 *
 * Computed from a before/after pair rather than accumulated during the merge, so
 * the user's conflict answers — applied after the merge, in `applyResolutions` —
 * are already in it. The caller runs this inside the write transaction against
 * exactly what it is about to store, so the numbers describe the rows on disk.
 */
export function countLocalChanges(
  before: GlossarySnapshot,
  after: GlossarySnapshot,
): GlossaryChangeCounts {
  let added = 0
  let updated = 0

  const glossariesBefore = new Map(before.glossaries.map((row) => [row.id, row]))
  for (const row of after.glossaries) {
    const was = glossariesBefore.get(row.id)
    if (was === undefined) added++
    else if (!glossaryEqual(was, row)) updated++
  }

  const termsBefore = new Map(before.terms.map((row) => [termIdentity(row), row]))
  for (const row of after.terms) {
    const was = termsBefore.get(termIdentity(row))
    if (was === undefined) added++
    else if (!termEqual(was, row)) updated++
  }

  const glossariesAfter = new Set(after.glossaries.map((row) => row.id))
  const termsAfter = new Set(after.terms.map(termIdentity))
  const removed =
    before.glossaries.filter((row) => !glossariesAfter.has(row.id)).length +
    before.terms.filter((row) => !termsAfter.has(termIdentity(row))).length

  return { added, updated, removed }
}

function termsByGlossary(terms: readonly SyncedTerm[]): Map<string, SyncedTerm[]> {
  const map = new Map<string, SyncedTerm[]>()
  for (const term of terms) {
    const list = map.get(term.glossaryId)
    if (list) list.push(term)
    else map.set(term.glossaryId, [term])
  }
  return map
}

/** Glossaries whose TERMS a side changed relative to base, however the glossary row itself reads. */
function glossariesWithTermChanges(base: GlossarySnapshot, side: GlossarySnapshot): Set<string> {
  const changed = new Set<string>()
  const baseTerms = new Map(base.terms.map((term) => [termIdentity(term), term]))
  const sideTerms = new Map(side.terms.map((term) => [termIdentity(term), term]))

  for (const [key, term] of sideTerms) {
    const before = baseTerms.get(key)
    if (before === undefined || !termEqual(before, term)) changed.add(term.glossaryId)
  }
  for (const [key, term] of baseTerms) {
    if (!sideTerms.has(key)) changed.add(term.glossaryId)
  }
  return changed
}

/**
 * Gives every output row its own Dexie primary key.
 *
 * Two rows can legitimately end up sharing one: identity is the triple, but the
 * uuid rides along from whichever row was merged, so the SAME term reworded
 * differently on two devices becomes two identities that both inherit the uuid
 * they were reworded from. Nothing above reports it — neither side deleted
 * anything, so there is no conflict and `localRowsRemoved` reads zero.
 *
 * Left alone it destroys one of the two edits: `bulkPut` keeps only the last of
 * the pair, so this device holds one row while the cloud holds both, and the
 * NEXT sync finds the missing identity in the base but not locally and reads it
 * as a deletion to propagate everywhere.
 *
 * Renumbering the loser is free. The uuid is only this device's storage key —
 * `fieldwiseMerge` already says so, and two devices that typed the same term
 * independently have always filed it under different uuids — while the identity
 * the merge runs on is untouched. The suffix is derived, not random, so the
 * function stays as pure as the rest of this file.
 *
 * Exported because this is an invariant of what gets WRITTEN, not of what this
 * one function returns: `applyResolutions` swaps raw side rows back in after
 * the merge, each carrying its original uuid, and has to re-establish it.
 */
export function withDistinctIds(terms: readonly SyncedTerm[]): SyncedTerm[] {
  const used = new Set<string>()
  return terms.map((term) => {
    if (!used.has(term.id)) {
      used.add(term.id)
      return term
    }
    let suffix = 2
    let candidate = `${term.id}-${suffix}`
    while (used.has(candidate)) candidate = `${term.id}-${++suffix}`
    used.add(candidate)
    return { ...term, id: candidate }
  })
}

function addStats(into: SetMergeStats, from: SetMergeStats): void {
  into.incoming += from.incoming
  into.outgoing += from.outgoing
  into.removed += from.removed
  into.unchanged += from.unchanged
}

/**
 * The whole merge: glossaries, then the terms inside each one, then the website
 * list inside each glossary — three levels of the same set merge.
 *
 * Deleting a glossary deletes everything in it, in one transaction, so a delete
 * is decided ABOUT THE GLOSSARY and never term by term. Deciding per row would
 * produce the worst outcome available: the glossary goes, one edited term is
 * kept to be safe, and that term is now unreachable — `loadGlossaryEntries`
 * starts from the glossaries, so nothing will ever compile it and no screen
 * lists it, while it still counts against the 20,000 cap. Both devices report
 * success.
 */
export function mergeGlossaryDocuments(
  triple: Triple<GlossarySnapshot>,
): MergeGlossaryDocumentsResult {
  const conflicts: GlossaryConflict[] = []

  const localTermChanges = glossariesWithTermChanges(triple.base, triple.local)
  const remoteTermChanges = glossariesWithTermChanges(triple.base, triple.remote)

  const baseById = new Map(triple.base.glossaries.map((g) => [g.id, g]))
  const localById = new Map(triple.local.glossaries.map((g) => [g.id, g]))
  const remoteById = new Map(triple.remote.glossaries.map((g) => [g.id, g]))

  const glossaryMerge = mergeSets<SyncedGlossary>(
    {
      base: triple.base.glossaries,
      local: triple.local.glossaries,
      remote: triple.remote.glossaries,
    },
    {
      identity: glossaryIdentity,
      equal: glossaryEqual,
      mergeRow: (base, local, remote) => {
        const merged = mergeGlossaryFields(base, local, remote)
        // The website list is a set, so two devices adding different sites is a
        // union rather than a choice. Its own three-way merge, one level down.
        //
        // No base means neither side ever agreed this list with the other, so
        // the empty set is the only honest ancestor and the merge is a union.
        // Passing `local.matchPatterns` instead would make every pattern only
        // this device has look like one the cloud deleted — silently dropped,
        // uncounted by the destructive gate (which weighs rows, never patterns)
        // and then uploaded. A first sync after an export/import round trip,
        // where both devices hold the same glossary uuid, is enough to fire it.
        const matchPatterns = mergeStringSet({
          base: base?.matchPatterns ?? [],
          local: local.matchPatterns,
          remote: remote.matchPatterns,
        })
        return {
          value: {
            ...merged.value,
            matchPatterns,
            createdAt: earlier(local.createdAt, remote.createdAt),
            updatedAt: later(local.updatedAt, remote.updatedAt),
          },
          conflicted: merged.conflicted,
        }
      },
    },
  )

  const glossaries = [...glossaryMerge.rows]
  for (const conflict of glossaryMerge.conflicts) {
    conflicts.push({ level: "glossary", conflict })
  }

  // A glossary can be dropped above while the surviving side was busy editing
  // its terms: the glossary ROW looked untouched, so the delete read as
  // uncontested. Put it back, with everything in it, and say so.
  const kept = new Set(glossaries.map((glossary) => glossary.id))
  for (const [id, before] of baseById) {
    if (kept.has(id)) continue
    const local = localById.get(id)
    const remote = remoteById.get(id)
    if (local !== undefined && remote !== undefined) continue
    if (local === undefined && remote === undefined) continue

    const survivor = local ?? remote
    if (survivor === undefined) continue
    const survivorChangedTerms =
      local !== undefined ? localTermChanges.has(id) : remoteTermChanges.has(id)
    if (!survivorChangedTerms) continue

    glossaries.push(survivor)
    kept.add(id)
    glossaryMerge.stats.removed--
    if (local === undefined) glossaryMerge.stats.incoming++
    else glossaryMerge.stats.outgoing++
    conflicts.push({
      level: "glossary",
      conflict: {
        key: id,
        kind: "edited-and-deleted",
        base: before,
        local,
        remote,
        resolution: survivor,
      },
    })
  }

  const baseTerms = termsByGlossary(triple.base.terms)
  const localTerms = termsByGlossary(triple.local.terms)
  const remoteTerms = termsByGlossary(triple.remote.terms)

  const merging: SyncedTerm[] = []
  const termStats: SetMergeStats = { incoming: 0, outgoing: 0, removed: 0, unchanged: 0 }

  for (const glossary of glossaries) {
    const inLocal = localById.has(glossary.id)
    const inRemote = remoteById.has(glossary.id)

    // Only one side has this glossary — either it is new there, or the other
    // side deleted it and lost the argument above. Either way that side holds
    // the only account of what is in it, and there is nothing to reconcile.
    if (!inLocal || !inRemote) {
      const owned = (inLocal ? localTerms.get(glossary.id) : remoteTerms.get(glossary.id)) ?? []
      merging.push(...owned)
      if (inLocal) termStats.outgoing += owned.length
      else termStats.incoming += owned.length
      continue
    }

    const merged = mergeSets<SyncedTerm>(
      {
        base: baseTerms.get(glossary.id) ?? [],
        local: localTerms.get(glossary.id) ?? [],
        remote: remoteTerms.get(glossary.id) ?? [],
      },
      {
        identity: termIdentity,
        equal: termEqual,
        mergeRow: (base, local, remote) => {
          const row = mergeTermFields(base, local, remote)
          return {
            value: { ...row.value, updatedAt: later(local.updatedAt, remote.updatedAt) },
            conflicted: row.conflicted,
          }
        },
      },
    )
    merging.push(...merged.rows)
    addStats(termStats, merged.stats)
    for (const conflict of merged.conflicts) {
      conflicts.push({ level: "term", glossaryId: glossary.id, conflict })
    }
  }

  const terms = withDistinctIds(merging)

  // Nothing above can produce a term whose glossary is gone. This is the
  // assertion of that, not a step that does work: it is cheap, and what it
  // guards against is invisible from every screen in the product.
  const orphans = terms.filter((term) => !kept.has(term.glossaryId))
  if (orphans.length > 0) {
    throw new Error(`glossary merge produced ${orphans.length} terms with no glossary`)
  }

  if (glossaries.length > MAX_GLOSSARIES) {
    return {
      ok: false,
      reason: "glossaryCapExceeded",
      overflowBy: glossaries.length - MAX_GLOSSARIES,
    }
  }
  if (terms.length > MAX_GLOSSARY_TERMS) {
    return { ok: false, reason: "termCapExceeded", overflowBy: terms.length - MAX_GLOSSARY_TERMS }
  }

  const keptTermKeys = new Set(terms.map(termIdentity))
  const localRowsRemoved =
    triple.local.glossaries.filter((glossary) => !kept.has(glossary.id)).length +
    triple.local.terms.filter((term) => !keptTermKeys.has(termIdentity(term))).length

  return {
    ok: true,
    merge: {
      glossaries,
      terms,
      conflicts,
      stats: {
        glossaries: glossaryMerge.stats,
        terms: termStats,
        localRowsRemoved,
        localRowsTotal: triple.local.glossaries.length + triple.local.terms.length,
      },
    },
  }
}
