/**
 * Three-way set merging, which is the whole of the glossary's sync logic.
 *
 * Everything the sync has to reconcile is a SET whose members are identified by
 * something other than their content: the glossaries (by uuid), the terms in one
 * glossary (by glossary + language + match key), and the websites one glossary
 * applies to (by the pattern string itself). So there is one algorithm here and
 * three callers, rather than three hand-written reconciliations.
 *
 * `base` is what this device uploaded, or downloaded, the last time it synced.
 * It is what makes "this device has a row the cloud does not" answerable: without
 * it that shape is indistinguishable between "I just added this" (keep it) and
 * "the other device deleted it" (drop it), and any sync that guesses loses data
 * in one of the two cases. It is the same merge base a three-way file merge uses.
 *
 * Nothing in this file touches Dexie, the network, or the clock.
 */

export interface Triple<T> {
  base: T
  local: T
  remote: T
}

export type Side = "local" | "remote"

/**
 * Why a row could not be reconciled without someone choosing.
 *
 * `edited-and-deleted` always resolves to KEEPING the row, and the asymmetry is
 * the reason: an unwanted row costs one click to delete again, while a deleted
 * wording the user typed is gone for good.
 */
export type ConflictKind = "both-edited" | "both-added" | "edited-and-deleted"

export interface RowConflict<V> {
  key: string
  kind: ConflictKind
  base?: V
  local?: V
  remote?: V
  /** What the merge used in the meantime. Every conflict here has one. */
  resolution: V
}

export interface SetMergeStats {
  /** Rows the merge took, in whole or in part, from the cloud. */
  incoming: number
  /** Rows the merge is sending, in whole or in part, to the cloud. */
  outgoing: number
  /** Rows dropped because one side deleted them and the other did not object. */
  removed: number
  unchanged: number
}

export interface SetMerge<V> {
  rows: V[]
  conflicts: RowConflict<V>[]
  stats: SetMergeStats
}

export interface SetMergeOptions<V> {
  /** What makes two rows the same row. NOT their storage key — see the module note. */
  identity: (row: V) => string
  /** Whether two versions of the same row say the same thing. */
  equal: (a: V, b: V) => boolean
  /**
   * Reconciles two versions of one row. `base` is absent when both sides added
   * the row independently, which is every user's first sync.
   */
  mergeRow: (base: V | undefined, local: V, remote: V) => { value: V; conflicted: boolean }
}

/** Keys in a stable order: base's first, then local's additions, then remote's. */
function unionKeys<V>(triple: Triple<readonly V[]>, identity: (row: V) => string): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  for (const rows of [triple.base, triple.local, triple.remote]) {
    for (const row of rows) {
      const key = identity(row)
      if (seen.has(key)) continue
      seen.add(key)
      keys.push(key)
    }
  }
  return keys
}

function index<V>(rows: readonly V[], identity: (row: V) => string): Map<string, V> {
  const map = new Map<string, V>()
  // Last wins, so a caller handing us a list that already contains two rows of
  // the same identity gets the later one rather than a silent half-merge.
  for (const row of rows) map.set(identity(row), row)
  return map
}

export function mergeSets<V>(
  triple: Triple<readonly V[]>,
  { identity, equal, mergeRow }: SetMergeOptions<V>,
): SetMerge<V> {
  const base = index(triple.base, identity)
  const local = index(triple.local, identity)
  const remote = index(triple.remote, identity)

  const rows: V[] = []
  const conflicts: RowConflict<V>[] = []
  const stats: SetMergeStats = { incoming: 0, outgoing: 0, removed: 0, unchanged: 0 }

  for (const key of unionKeys(triple, identity)) {
    const b = base.get(key)
    const l = local.get(key)
    const r = remote.get(key)

    if (l !== undefined && r !== undefined) {
      if (b !== undefined && equal(l, b) && equal(r, b)) {
        rows.push(l)
        stats.unchanged++
        continue
      }
      const { value, conflicted } = mergeRow(b, l, r)
      rows.push(value)
      if (conflicted) {
        conflicts.push({
          key,
          kind: b === undefined ? "both-added" : "both-edited",
          base: b,
          local: l,
          remote: r,
          resolution: value,
        })
      }
      const tookFromRemote = !equal(value, l)
      const tookFromLocal = !equal(value, r)
      if (tookFromRemote) stats.incoming++
      if (tookFromLocal) stats.outgoing++
      if (!tookFromRemote && !tookFromLocal) stats.unchanged++
      continue
    }

    if (l !== undefined) {
      if (b === undefined) {
        rows.push(l)
        stats.outgoing++
        continue
      }
      if (equal(l, b)) {
        // The cloud dropped it and this device never touched it since. That is
        // the other device's delete arriving, and it is the whole reason a
        // delete needs no tombstone: the remote is a complete document.
        stats.removed++
        continue
      }
      rows.push(l)
      stats.outgoing++
      conflicts.push({ key, kind: "edited-and-deleted", base: b, local: l, resolution: l })
      continue
    }

    if (r !== undefined) {
      if (b === undefined) {
        rows.push(r)
        stats.incoming++
        continue
      }
      if (equal(r, b)) {
        stats.removed++
        continue
      }
      rows.push(r)
      stats.incoming++
      conflicts.push({ key, kind: "edited-and-deleted", base: b, remote: r, resolution: r })
      continue
    }

    // Neither side has it any more: both deleted it, or it survives only in a
    // base that is now out of date. Either way it goes.
    stats.removed++
  }

  return { rows, conflicts, stats }
}

/**
 * A row merge that works one field at a time.
 *
 * Field-level rather than whole-row, because the two sides usually changed
 * DIFFERENT things: turning a term off on the laptop and rewording it on the
 * desktop are both wanted, and an all-or-nothing row merge would make the user
 * choose between them for no reason.
 *
 * The returned row is built on `local`, so anything outside `fields` stays
 * exactly as this device has it. That is deliberate for the primary key: two
 * devices that independently added the same term hold two different uuids for
 * it, and neither has to win — the uuid is this device's storage key, while the
 * identity the merge runs on is the term itself.
 */
export function fieldwiseMerge<V extends object>({
  fields,
  prefer,
  equalField = Object.is,
}: {
  fields: readonly (keyof V)[]
  /**
   * Which side takes a field both sides changed, differently. MUST give the same
   * answer on both devices — it is handed the two rows, never "mine" and
   * "theirs" — or the two never stop overwriting each other.
   */
  prefer: (local: V, remote: V) => Side
  /** For fields that are not primitives. */
  equalField?: (a: unknown, b: unknown) => boolean
}): (base: V | undefined, local: V, remote: V) => { value: V; conflicted: boolean } {
  return (base, local, remote) => {
    const winner = prefer(local, remote) === "local" ? local : remote
    const value = { ...local }
    let conflicted = false

    for (const field of fields) {
      const l = local[field]
      const r = remote[field]
      if (equalField(l, r)) continue

      if (base === undefined) {
        // Both sides created this row, so there is no common ancestor to say who
        // changed what. Any disagreement is one.
        conflicted = true
        value[field] = winner[field]
        continue
      }

      const b = base[field]
      const localChanged = !equalField(l, b)
      const remoteChanged = !equalField(r, b)

      if (localChanged && remoteChanged) {
        conflicted = true
        value[field] = winner[field]
      } else if (remoteChanged) {
        value[field] = r
      }
      // Only local changed, or neither did: `value` already holds local's.
    }

    return { value, conflicted }
  }
}

/**
 * The third level: a plain set of strings, merged by the same rules.
 *
 * A glossary's website list is a set, not a value, so the two sides adding
 * different sites is not a conflict — it is a union. Treating it as one opaque
 * value (which is what the config sync does with every array) would force the
 * user to throw one device's additions away.
 */
export function mergeStringSet(triple: Triple<readonly string[]>): string[] {
  return mergeSets(triple, {
    identity: (value) => value,
    // Two equal strings cannot disagree, so nothing below the identity matters.
    equal: () => true,
    mergeRow: (_base, local) => ({ value: local, conflicted: false }),
  }).rows
}
