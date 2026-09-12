import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SyncedGlossary, SyncedTerm } from "./document"
import type { GlossaryChangeCounts, GlossarySnapshot } from "./merge-document"
import type GlossaryTerm from "@/utils/db/dexie/tables/glossary-term"
import { MAX_GLOSSARIES, MAX_GLOSSARY_TERMS } from "@/utils/constants/glossary"
import { db } from "@/utils/db/dexie/db"
import {
  GLOSSARY_SYNC_BASE_ID,
  GLOSSARY_SYNC_UNDO_ID,
} from "@/utils/db/dexie/tables/glossary-sync-snapshot"
import { bumpGlossaryRevision } from "../repository"
import { countLocalChanges, termIdentity, withDistinctIds } from "./merge-document"

/** Everything the sync sends, in the shape the merge works on. */
export async function readLocalGlossary(): Promise<GlossarySnapshot> {
  const [glossaries, terms] = await Promise.all([db.glossary.toArray(), db.glossaryTerm.toArray()])
  return { glossaries, terms }
}

export interface StoredSyncBase {
  email: string
  snapshot: GlossarySnapshot
}

export async function readSyncBase(): Promise<StoredSyncBase | null> {
  const row = await db.glossarySyncSnapshot.get(GLOSSARY_SYNC_BASE_ID)
  if (!row) return null
  return { email: row.email, snapshot: { glossaries: row.glossaries, terms: row.terms } }
}

export async function readUndoSnapshot(): Promise<GlossarySnapshot | null> {
  const row = await db.glossarySyncSnapshot.get(GLOSSARY_SYNC_UNDO_ID)
  if (!row) return null
  return { glossaries: row.glossaries, terms: row.terms }
}

/**
 * Which operation filled the undo slot.
 *
 * There is one slot and two things write it, each leaving a toast with its own
 * Undo button — and the toasts outlive the operation that raised them. A sync
 * followed by an import, both still on screen, otherwise lets the sync's Undo
 * restore the IMPORT's snapshot and drop the sync base along with it, returning
 * the user to a state nobody asked for. Stamping the slot lets a button that no
 * longer owns it say so instead.
 */
export type UndoSource = "sync" | "import"

/**
 * A cheap description of what is in the two tables right now.
 *
 * Compared inside the write transaction against what the merge was computed
 * from. The upload takes seconds, and anything the user typed in another tab
 * meanwhile would otherwise be overwritten by a wholesale apply and never
 * uploaded — invisible to this device and to the cloud.
 */
export function fingerprint(snapshot: GlossarySnapshot): string {
  const glossaries = snapshot.glossaries
    .map((g) => `${g.id}:${g.updatedAt.getTime()}:${g.name}:${g.enabled}:${g.matchPatterns.join()}`)
    .sort()
  const terms = snapshot.terms
    .map((t) => `${t.id}:${t.updatedAt.getTime()}:${t.target}:${t.enabled}`)
    .sort()
  return `${glossaries.length}|${terms.length}|${glossaries.join("\u0000")}|${terms.join("\u0000")}`
}

export class GlossaryChangedDuringSyncError extends Error {
  constructor() {
    super("the glossary changed while the sync was uploading")
    this.name = "GlossaryChangedDuringSyncError"
  }
}

/**
 * The only write the sync makes, and it is one transaction.
 *
 * Order matters and is not negotiable: the caller must have uploaded FIRST and
 * must pass exactly what it uploaded. `base` is set from that payload rather
 * than from a re-read of these tables afterwards — a re-read would bake an edit
 * made during the upload into the base, so it would look already-synced forever
 * while the cloud had never seen it.
 *
 * `undo` is captured here, from the rows as they stand, so the snapshot the user
 * can restore is the one the merge actually replaced.
 *
 * Returns what it did to this device's rows. Counted here, against the rows it
 * is replacing and the payload it is storing, because this is the only point
 * that holds both — and by then the user's conflict answers are already in the
 * payload, which the merge's own stats predate.
 */
export async function applyMergedGlossary({
  glossaries,
  terms,
  email,
  expectedFingerprint,
}: {
  glossaries: readonly SyncedGlossary[]
  terms: readonly SyncedTerm[]
  email: string
  expectedFingerprint: string
}): Promise<GlossaryChangeCounts> {
  const counts = await db.transaction(
    "rw",
    db.glossary,
    db.glossaryTerm,
    db.glossarySyncSnapshot,
    async () => {
      const current = await readLocalGlossary()
      if (fingerprint(current) !== expectedFingerprint) {
        throw new GlossaryChangedDuringSyncError()
      }

      const now = new Date()
      await db.glossarySyncSnapshot.put({
        id: GLOSSARY_SYNC_UNDO_ID,
        email: "",
        source: "sync",
        // What the tables will hold once this transaction commits, so `undo`
        // can tell later edits from the state it is entitled to replace.
        fingerprintAfter: fingerprint({ glossaries, terms }),
        capturedAt: now,
        glossaries: [...current.glossaries],
        terms: [...current.terms],
      })

      await db.glossary.clear()
      await db.glossaryTerm.clear()
      await db.glossary.bulkPut(glossaries.map((glossary) => ({ ...glossary })))
      await db.glossaryTerm.bulkPut(terms.map(toStoredTerm))

      await db.glossarySyncSnapshot.put({
        id: GLOSSARY_SYNC_BASE_ID,
        email,
        capturedAt: now,
        glossaries: glossaries.map((glossary) => ({ ...glossary })),
        terms: terms.map((term) => ({ ...term })),
      })

      return countLocalChanges(current, { glossaries, terms })
    },
  )

  // Once, after the whole write, so every open page recompiles its matcher
  // instead of waiting for its next navigation.
  await bumpGlossaryRevision()
  return counts
}

/**
 * Puts back whatever last replaced the glossary wholesale — a merge, or an
 * import from a file.
 *
 * `clearBase` belongs to the merge case only. Undoing a MERGE must drop the base
 * as well: it describes an agreement with the cloud that the restored rows no
 * longer match, so the next sync would read them as deletions and push the undo
 * out to every other device as data loss. Undoing an IMPORT must NOT drop it —
 * the base still describes the last real agreement, and keeping it lets the next
 * sync merge normally instead of starting over.
 */
export async function restoreUndoSnapshot({
  source,
  clearBase,
}: {
  source: UndoSource
  clearBase: boolean
}): Promise<boolean> {
  const restored = await db.transaction(
    "rw",
    db.glossary,
    db.glossaryTerm,
    db.glossarySyncSnapshot,
    async () => {
      const undo = await db.glossarySyncSnapshot.get(GLOSSARY_SYNC_UNDO_ID)
      if (!undo) return false
      // Something else has filled the slot since this button was drawn. Its
      // snapshot is not the one this toast promised to put back, and
      // `clearBase` is only right for the operation that wrote it.
      if (undo.source !== source) return false
      // The user has edited the glossary since. This replaces both tables
      // wholesale, so going ahead would silently delete every one of those
      // edits — an undo that destroys newer work is not an undo.
      if (
        undo.fingerprintAfter !== undefined &&
        undo.fingerprintAfter !== fingerprint(await readLocalGlossary())
      ) {
        return false
      }

      await db.glossary.clear()
      await db.glossaryTerm.clear()
      await db.glossary.bulkPut(undo.glossaries.map((glossary) => ({ ...glossary })))
      await db.glossaryTerm.bulkPut(undo.terms.map(toStoredTerm))

      if (clearBase) await db.glossarySyncSnapshot.delete(GLOSSARY_SYNC_BASE_ID)
      await db.glossarySyncSnapshot.delete(GLOSSARY_SYNC_UNDO_ID)
      return true
    },
  )

  if (restored) await bumpGlossaryRevision()
  return restored
}

/** Drops the base, which turns the next sync into a first sync. */
export async function clearSyncBase(): Promise<void> {
  await db.glossarySyncSnapshot.delete(GLOSSARY_SYNC_BASE_ID)
}

/**
 * `targetLang` travels as a plain string so that a value written by a newer
 * build survives the round trip instead of being dropped — see the document
 * schema. The column holds a string either way; a value this build does not
 * recognise simply never matches a page, and reaches the other device intact.
 */
function toStoredTerm(term: SyncedTerm): GlossaryTerm {
  return { ...term, targetLang: term.targetLang as LangCodeISO6393 } as GlossaryTerm
}

export type GlossaryCapOverflow = {
  reason: "termCapExceeded" | "glossaryCapExceeded"
  overflowBy: number
}

export type ReplaceGlossaryResult =
  | { ok: true; glossaries: number; terms: number }
  | ({ ok: false } & GlossaryCapOverflow)

/**
 * Whether a document would fit, without writing anything.
 *
 * Separate from `replaceGlossary` so a caller that replaces OTHER things in the
 * same operation can ask before it starts. The settings import does: it writes
 * the config first, so discovering the overflow inside the replace left exactly
 * the half import its own comment says it prevents — settings swapped, terms
 * not — under a message reading "Nothing was changed."
 */
export function checkGlossaryCaps(document: {
  glossaries: readonly SyncedGlossary[]
  terms: readonly SyncedTerm[]
}): GlossaryCapOverflow | null {
  if (document.glossaries.length > MAX_GLOSSARIES) {
    return {
      reason: "glossaryCapExceeded",
      overflowBy: document.glossaries.length - MAX_GLOSSARIES,
    }
  }
  if (document.terms.length > MAX_GLOSSARY_TERMS) {
    return { reason: "termCapExceeded", overflowBy: document.terms.length - MAX_GLOSSARY_TERMS }
  }
  return null
}

/**
 * Replaces the whole glossary with what a file carried.
 *
 * Replace rather than merge, because that is what importing a settings file
 * means everywhere else in this screen — and because a file has no merge base,
 * so a merge could only guess which side a missing row was deleted from. The
 * rows it replaces go to the `undo` slot, so the toast can put them back.
 *
 * Deliberately does NOT touch the sync base: those rows are now local changes
 * like any others, and the next sync merges them against the cloud normally.
 */
export async function replaceGlossary(document: {
  glossaries: readonly SyncedGlossary[]
  terms: readonly SyncedTerm[]
}): Promise<ReplaceGlossaryResult> {
  const overflow = checkGlossaryCaps(document)
  if (overflow) return { ok: false, ...overflow }

  // A term whose glossary is not in the same file would be unreachable from
  // every screen while still counting against the cap — the same grave the merge
  // refuses to dig.
  const ids = new Set(document.glossaries.map((glossary) => glossary.id))
  const owned = document.terms.filter((term) => ids.has(term.glossaryId))

  // Two rows the database cannot hold at once, deduped here rather than left to
  // `bulkPut`. A file is not required to have come from this extension, and a
  // hand-edited one can carry the same `(glossaryId, targetLang, matchKey)`
  // twice under different uuids: the unique index rejects that, the transaction
  // rolls back, and the settings import that already replaced the config
  // reports failure with the new settings installed. Last wins, which is what
  // `mergeSets` does with the same shape.
  const byIdentity = new Map(owned.map((term) => [termIdentity(term), term]))
  // ...and two rows sharing one primary key, which `bulkPut` would silently
  // collapse to whichever came last.
  const terms = withDistinctIds([...byIdentity.values()])

  await db.transaction("rw", db.glossary, db.glossaryTerm, db.glossarySyncSnapshot, async () => {
    const current = await readLocalGlossary()
    await db.glossarySyncSnapshot.put({
      id: GLOSSARY_SYNC_UNDO_ID,
      email: "",
      source: "import",
      fingerprintAfter: fingerprint({ glossaries: document.glossaries, terms }),
      capturedAt: new Date(),
      glossaries: [...current.glossaries],
      terms: [...current.terms],
    })

    await db.glossary.clear()
    await db.glossaryTerm.clear()
    await db.glossary.bulkPut(document.glossaries.map((glossary) => ({ ...glossary })))
    await db.glossaryTerm.bulkPut(terms.map(toStoredTerm))
  })

  await bumpGlossaryRevision()
  return { ok: true, glossaries: document.glossaries.length, terms: terms.length }
}
