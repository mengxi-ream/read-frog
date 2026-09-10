import type { ParsedGlossaryRow } from "./csv"
import type { GlossaryEntry } from "./types"
import type GlossaryTerm from "@/utils/db/dexie/tables/glossary-term"
import { storage } from "#imports"
import { db } from "@/utils/db/dexie/db"
import {
  MAX_GLOSSARY_SOURCE_LENGTH,
  MAX_GLOSSARY_TARGET_LENGTH,
  MAX_GLOSSARY_TERMS,
} from "../constants/glossary"
import { getRandomUUID } from "../crypto-polyfill"
import { formatGlossaryCsv } from "./csv"
import { buildMatchKey } from "./match-key"

/**
 * Bumped on every write. The content script compiles a matcher from a snapshot
 * and caches it against this number, so it can tell a stale compile from a
 * current one without diffing the term list.
 */
const GLOSSARY_REVISION_KEY = "local:glossaryRevision" as const

export async function getGlossaryRevision(): Promise<number> {
  return (await storage.getItem<number>(GLOSSARY_REVISION_KEY)) ?? 0
}

async function bumpGlossaryRevision(): Promise<number> {
  const next = (await getGlossaryRevision()) + 1
  await storage.setItem<number>(GLOSSARY_REVISION_KEY, next)
  return next
}

export interface GlossaryTermInput {
  source: string
  target: string
  caseSensitive: boolean
  enabled?: boolean
}

export type SaveGlossaryTermResult =
  | { ok: true; id: string }
  | { ok: false; reason: "emptySource" | "tooLong" | "capReached" | "duplicate" }

function validate(input: GlossaryTermInput): "emptySource" | "tooLong" | null {
  if (input.source.trim() === "") return "emptySource"
  if (
    input.source.length > MAX_GLOSSARY_SOURCE_LENGTH ||
    input.target.length > MAX_GLOSSARY_TARGET_LENGTH
  ) {
    return "tooLong"
  }
  return null
}

export async function listGlossaryTerms(): Promise<GlossaryTerm[]> {
  return db.glossaryTerm.orderBy("updatedAt").reverse().toArray()
}

export async function countGlossaryTerms(): Promise<number> {
  return db.glossaryTerm.count()
}

/**
 * Entries the matcher should compile. Disabled rows are dropped here rather
 * than inside the matcher, so the matcher stays a pure function of what it was
 * handed and the snapshot sent to a content script carries nothing unusable.
 */
export async function loadGlossaryEntries(): Promise<GlossaryEntry[]> {
  const terms = await db.glossaryTerm.toArray()
  return terms
    .filter((term) => term.enabled)
    .map((term) => ({
      matchKey: term.matchKey,
      source: term.source,
      target: term.target,
      caseSensitive: term.caseSensitive,
    }))
}

/**
 * Create or update one entry.
 *
 * `existingId` distinguishes an edit from an add: editing a row's source text
 * changes its `matchKey`, which must not collide with a DIFFERENT row, but must
 * be allowed to stay on the row being edited.
 */
export async function saveGlossaryTerm(
  input: GlossaryTermInput,
  existingId?: string,
): Promise<SaveGlossaryTermResult> {
  const invalid = validate(input)
  if (invalid) return { ok: false, reason: invalid }

  const source = input.source.trim()
  const matchKey = buildMatchKey(source, input.caseSensitive)

  const clash = await db.glossaryTerm.where("matchKey").equals(matchKey).first()
  if (clash && clash.id !== existingId) return { ok: false, reason: "duplicate" }

  if (!existingId && (await countGlossaryTerms()) >= MAX_GLOSSARY_TERMS) {
    return { ok: false, reason: "capReached" }
  }

  const id = existingId ?? getRandomUUID()
  await db.glossaryTerm.put({
    id,
    matchKey,
    source,
    target: input.target.trim(),
    caseSensitive: input.caseSensitive,
    enabled: input.enabled ?? true,
    updatedAt: new Date(),
  })
  await bumpGlossaryRevision()
  return { ok: true, id }
}

/**
 * Flip one term's `enabled` flag. Disabled terms stay in the list and in an
 * export; they are simply dropped from what `loadGlossaryEntries` compiles.
 *
 * Deliberately does NOT restamp `updatedAt`. The table is ordered by it, so a
 * restamp would teleport the row the user just clicked to the top of page 1 —
 * out of view entirely when they are further down a paginated list. Nothing
 * depends on the stamp to notice this edit: a cross-device merge compares a row
 * against its base, and plan D12.6 fixes `updatedAt` as display ordering plus a
 * tie-break rather than the edit signal.
 *
 * Addressed by `id` rather than `matchKey` precisely because `id` is the stable
 * key — see the note on the table class.
 */
export async function setGlossaryTermEnabled(id: string, enabled: boolean): Promise<void> {
  // A row deleted in another tab between render and click updates nothing, and
  // bumping the revision then recompiles every matcher for no reason.
  const updated = await db.glossaryTerm.update(id, { enabled })
  if (updated === 0) return
  await bumpGlossaryRevision()
}

export async function deleteGlossaryTerm(id: string): Promise<void> {
  await db.glossaryTerm.delete(id)
  await bumpGlossaryRevision()
}

export async function deleteAllGlossaryTerms(): Promise<void> {
  await db.glossaryTerm.clear()
  await bumpGlossaryRevision()
}

export type ImportMode = "merge" | "replace"

export interface ImportGlossaryResult {
  ok: boolean
  added: number
  updated: number
  /** Rows dropped because an earlier row in the same file claimed the same term. */
  duplicatesInFile: number
  /** Set when the import was refused; the list is left untouched. */
  overflowBy?: number
}

/**
 * Import parsed rows.
 *
 * Deduped by `matchKey` BEFORE any write: the table has a unique index on it and
 * Dexie's `bulkPut` would otherwise commit the survivors and report a partial
 * failure, leaving the caller unable to say what actually landed.
 *
 * Over the cap the import is REFUSED whole, reporting the exact overflow. Never
 * truncate — a silently half-imported glossary is worse than a rejected one,
 * because the user cannot see which half is missing.
 */
export async function importGlossaryRows(
  rows: readonly ParsedGlossaryRow[],
  mode: ImportMode,
  caseSensitive: boolean,
): Promise<ImportGlossaryResult> {
  const byMatchKey = new Map<string, ParsedGlossaryRow>()
  let duplicatesInFile = 0
  for (const row of rows) {
    const source = row.source.trim()
    if (source === "") continue
    const key = buildMatchKey(source, caseSensitive)
    // Last write wins within a file: a user fixing a term further down the file
    // means the later line.
    if (byMatchKey.has(key)) duplicatesInFile++
    byMatchKey.set(key, { ...row, source })
  }

  const existing = mode === "replace" ? [] : await db.glossaryTerm.toArray()
  const existingByKey = new Map(existing.map((term) => [term.matchKey, term]))

  let added = 0
  let updated = 0
  for (const key of byMatchKey.keys()) {
    if (existingByKey.has(key)) updated++
    else added++
  }

  const finalCount = mode === "replace" ? byMatchKey.size : existing.length + added
  if (finalCount > MAX_GLOSSARY_TERMS) {
    return {
      ok: false,
      added: 0,
      updated: 0,
      duplicatesInFile,
      overflowBy: finalCount - MAX_GLOSSARY_TERMS,
    }
  }

  const now = new Date()
  const records: GlossaryTerm[] = [...byMatchKey.entries()].map(([matchKey, row]) => ({
    id: existingByKey.get(matchKey)?.id ?? getRandomUUID(),
    matchKey,
    source: row.source,
    target: row.target.trim(),
    caseSensitive,
    // An import must not silently re-enable a term the user turned off; a row
    // absent from the table is the only one that starts enabled.
    enabled: existingByKey.get(matchKey)?.enabled ?? true,
    updatedAt: now,
  })) as GlossaryTerm[]

  await db.transaction("rw", db.glossaryTerm, async () => {
    if (mode === "replace") await db.glossaryTerm.clear()
    await db.glossaryTerm.bulkPut(records)
  })
  await bumpGlossaryRevision()

  return { ok: true, added, updated, duplicatesInFile }
}

export async function exportGlossaryCsv(): Promise<string> {
  const terms = await db.glossaryTerm.orderBy("matchKey").toArray()
  return formatGlossaryCsv(terms.map((term) => ({ source: term.source, target: term.target })))
}
