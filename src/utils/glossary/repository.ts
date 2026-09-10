import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { ParsedGlossaryRow } from "./csv"
import type { GlossaryEntry } from "./types"
import type Glossary from "@/utils/db/dexie/tables/glossary"
import type GlossaryTerm from "@/utils/db/dexie/tables/glossary-term"
import { storage } from "#imports"
import { db } from "@/utils/db/dexie/db"
import {
  GLOSSARY_REVISION_KEY,
  MAX_GLOSSARIES,
  MAX_GLOSSARY_DESCRIPTION_LENGTH,
  MAX_GLOSSARY_NAME_LENGTH,
  MAX_GLOSSARY_SOURCE_LENGTH,
  MAX_GLOSSARY_TARGET_LENGTH,
  MAX_GLOSSARY_TERMS,
} from "../constants/glossary"
import { getRandomUUID } from "../crypto-polyfill"
import { formatGlossaryCsv, resolveRowTargetLanguage } from "./csv"
import { buildMatchKey } from "./match-key"
import { isGlossaryActiveForUrl, mergeGlossaryTerms } from "./scope"

export async function getGlossaryRevision(): Promise<number> {
  return (await storage.getItem<number>(GLOSSARY_REVISION_KEY)) ?? 0
}

async function bumpGlossaryRevision(): Promise<number> {
  const next = (await getGlossaryRevision()) + 1
  await storage.setItem<number>(GLOSSARY_REVISION_KEY, next)
  return next
}

// ---------------------------------------------------------------------------
// Glossaries
// ---------------------------------------------------------------------------

/** Oldest first: the order the list is shown in, and the precedence order. */
export async function listGlossaries(): Promise<Glossary[]> {
  return db.glossary.orderBy("createdAt").toArray()
}

export async function getGlossary(id: string): Promise<Glossary | undefined> {
  return db.glossary.get(id)
}

export type CreateGlossaryResult = { ok: true; id: string } | { ok: false; reason: "capReached" }

/**
 * `name` is REQUIRED and comes from the caller, because the default has to be
 * localized and this layer has no UI language. It is the one place a glossary's
 * name is allowed to be chosen, so everything downstream can render
 * `glossary.name` without a fallback.
 */
export async function createGlossary(name: string): Promise<CreateGlossaryResult> {
  if ((await db.glossary.count()) >= MAX_GLOSSARIES) {
    return { ok: false, reason: "capReached" }
  }

  const now = new Date()
  const id = getRandomUUID()
  await db.glossary.put({
    id,
    name: name.trim().slice(0, MAX_GLOSSARY_NAME_LENGTH),
    description: "",
    enabled: true,
    // Empty = every site, so a new glossary works before it is configured.
    matchPatterns: [],
    createdAt: now,
    updatedAt: now,
  })
  // Deliberately no revision bump: an empty glossary changes nothing a page
  // could match, and bumping would recompile every open page's matcher.
  return { ok: true, id }
}

/**
 * Rename or re-describe a glossary.
 *
 * An empty name is IGNORED rather than stored: the name is required, and this is
 * the boundary that guarantees it, so every reader can render `glossary.name`
 * directly. The description has no such rule — blank is a legitimate value.
 *
 * Deliberately does NOT bump the revision. Neither field takes part in matching
 * or reaches the prompt, so a bump would make every open page recompile up to
 * 20,000 terms because someone typed a letter into a name field.
 */
export async function updateGlossaryMeta(
  id: string,
  meta: { name?: string; description?: string },
): Promise<void> {
  const patch: Partial<Glossary> = { updatedAt: new Date() }
  const name = meta.name?.trim()
  if (name) patch.name = name.slice(0, MAX_GLOSSARY_NAME_LENGTH)
  if (meta.description !== undefined) {
    patch.description = meta.description.slice(0, MAX_GLOSSARY_DESCRIPTION_LENGTH)
  }
  await db.glossary.update(id, patch)
}

export async function setGlossaryEnabled(id: string, enabled: boolean): Promise<void> {
  const updated = await db.glossary.update(id, { enabled, updatedAt: new Date() })
  if (updated === 0) return
  await bumpGlossaryRevision()
}

export async function setGlossaryPatterns(id: string, matchPatterns: string[]): Promise<void> {
  const updated = await db.glossary.update(id, { matchPatterns, updatedAt: new Date() })
  if (updated === 0) return
  await bumpGlossaryRevision()
}

/** Removes the glossary and everything in it, in one transaction. */
export async function deleteGlossary(id: string): Promise<void> {
  await db.transaction("rw", db.glossary, db.glossaryTerm, async () => {
    await db.glossaryTerm.where("glossaryId").equals(id).delete()
    await db.glossary.delete(id)
  })
  await bumpGlossaryRevision()
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export interface GlossaryTermInput {
  source: string
  target: string
  caseSensitive: boolean
  /** Which target language this wording is for. */
  targetLang: LangCodeISO6393
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

export async function listGlossaryTerms(glossaryId: string): Promise<GlossaryTerm[]> {
  return db.glossaryTerm
    .where("glossaryId")
    .equals(glossaryId)
    .reverse()
    .sortBy("updatedAt")
    .then((terms) => terms.reverse())
}

/**
 * How many terms are stored.
 *
 * Without an id this is the TOTAL across every glossary, which is what
 * `MAX_GLOSSARY_TERMS` caps: the ceiling protects the compiled alternation and
 * the memory it lives in, and neither cares how the terms are filed.
 */
export async function countGlossaryTerms(glossaryId?: string): Promise<number> {
  if (glossaryId === undefined) return db.glossaryTerm.count()
  return db.glossaryTerm.where("glossaryId").equals(glossaryId).count()
}

export async function countGlossaryTermsByGlossary(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  await db.glossaryTerm.each((term) => {
    counts.set(term.glossaryId, (counts.get(term.glossaryId) ?? 0) + 1)
  })
  return counts
}

/**
 * The entries the matcher should compile for a page.
 *
 * Scoping happens HERE rather than inside the matcher so that the snapshot sent
 * to a content script carries nothing it cannot use, and so the matcher stays a
 * pure function of what it was handed. Disabled rows are dropped for the same
 * reason.
 *
 * `url` is undefined where there is no page — see `isGlossaryActiveForUrl`.
 *
 * Terms are filtered to `targetLang`: a wording written for Japanese has no
 * business in a Chinese prompt. That filter is also why the language needs no
 * place in the translation cache key — see the note on the table class.
 */
export async function loadGlossaryEntries(
  targetLang: LangCodeISO6393,
  url?: string,
): Promise<GlossaryEntry[]> {
  const active = (await listGlossaries()).filter((glossary) =>
    isGlossaryActiveForUrl(glossary, url),
  )
  if (active.length === 0) return []

  const groups = await Promise.all(
    active.map(async (glossary) => {
      const terms = await db.glossaryTerm.where("glossaryId").equals(glossary.id).toArray()
      return terms
        .filter((term) => term.enabled && term.targetLang === targetLang)
        .map((term): GlossaryEntry => ({
          matchKey: term.matchKey,
          source: term.source,
          target: term.target,
          caseSensitive: term.caseSensitive,
        }))
    }),
  )
  return mergeGlossaryTerms(groups)
}

/**
 * Create or update one term.
 *
 * `existingId` distinguishes an edit from an add: editing a row's source text
 * changes its `matchKey`, which must not collide with a DIFFERENT row in the
 * same glossary, but must be allowed to stay on the row being edited.
 */
export async function saveGlossaryTerm(
  glossaryId: string,
  input: GlossaryTermInput,
  existingId?: string,
): Promise<SaveGlossaryTermResult> {
  const invalid = validate(input)
  if (invalid) return { ok: false, reason: invalid }

  const source = input.source.trim()
  const matchKey = buildMatchKey(source, input.caseSensitive)

  const clash = await db.glossaryTerm
    .where("[glossaryId+targetLang+matchKey]")
    .equals([glossaryId, input.targetLang, matchKey])
    .first()
  if (clash && clash.id !== existingId) return { ok: false, reason: "duplicate" }

  if (!existingId && (await countGlossaryTerms()) >= MAX_GLOSSARY_TERMS) {
    return { ok: false, reason: "capReached" }
  }

  const id = existingId ?? getRandomUUID()
  await db.glossaryTerm.put({
    id,
    glossaryId,
    matchKey,
    targetLang: input.targetLang,
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
 * out of view entirely when they are further down a paginated list.
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

export async function deleteAllGlossaryTerms(glossaryId: string): Promise<void> {
  await db.glossaryTerm.where("glossaryId").equals(glossaryId).delete()
  await bumpGlossaryRevision()
}

export type ImportMode = "merge" | "replace"

export interface ImportGlossaryResult {
  ok: boolean
  added: number
  updated: number
  /** Rows dropped because an earlier row in the same file claimed the same term. */
  duplicatesInFile: number
  /** Rows dropped because their `targetLanguage` column named a language we cannot translate into. */
  unknownLanguage: number
  /** Set when the import was refused; the list is left untouched. */
  overflowBy?: number
}

/**
 * Import parsed rows into one glossary.
 *
 * Deduped by `matchKey` BEFORE any write: the table has a unique index on
 * `[glossaryId+matchKey]` and Dexie's `bulkPut` would otherwise commit the
 * survivors and report a partial failure, leaving the caller unable to say what
 * actually landed.
 *
 * Over the cap the import is REFUSED whole, reporting the exact overflow. Never
 * truncate — a silently half-imported glossary is worse than a rejected one,
 * because the user cannot see which half is missing. The cap counts every
 * glossary, so an import is measured against the whole library, not this list.
 */
export async function importGlossaryRows(
  glossaryId: string,
  rows: readonly ParsedGlossaryRow[],
  mode: ImportMode,
  caseSensitive: boolean,
  fallbackLang: LangCodeISO6393,
): Promise<ImportGlossaryResult> {
  // Keyed by language AND term, because one file may carry both a Chinese and a
  // Japanese wording of the same word and neither displaces the other.
  const byKey = new Map<string, { row: ParsedGlossaryRow; targetLang: LangCodeISO6393 }>()
  let duplicatesInFile = 0
  let unknownLanguage = 0
  for (const row of rows) {
    const source = row.source.trim()
    if (source === "") continue
    const targetLang = resolveRowTargetLanguage(row, fallbackLang)
    if (targetLang === null) {
      unknownLanguage++
      continue
    }
    const matchKey = buildMatchKey(source, caseSensitive)
    const key = `${targetLang}\u0000${matchKey}`
    // Last write wins within a file: a user fixing a term further down the file
    // means the later line.
    if (byKey.has(key)) duplicatesInFile++
    byKey.set(key, { row: { ...row, source }, targetLang })
  }

  const existing =
    mode === "replace" ? [] : await db.glossaryTerm.where("glossaryId").equals(glossaryId).toArray()
  const existingByKey = new Map(
    existing.map((term) => [`${term.targetLang}\u0000${term.matchKey}`, term]),
  )

  let added = 0
  let updated = 0
  for (const key of byKey.keys()) {
    if (existingByKey.has(key)) updated++
    else added++
  }

  const totalTerms = await countGlossaryTerms()
  const termsInThisGlossary = await countGlossaryTerms(glossaryId)
  const finalCount =
    mode === "replace" ? totalTerms - termsInThisGlossary + byKey.size : totalTerms + added
  if (finalCount > MAX_GLOSSARY_TERMS) {
    return {
      ok: false,
      added: 0,
      updated: 0,
      duplicatesInFile,
      unknownLanguage,
      overflowBy: finalCount - MAX_GLOSSARY_TERMS,
    }
  }

  const now = new Date()
  const records: GlossaryTerm[] = [...byKey.entries()].map(([key, { row, targetLang }]) => ({
    id: existingByKey.get(key)?.id ?? getRandomUUID(),
    glossaryId,
    matchKey: buildMatchKey(row.source, caseSensitive),
    targetLang,
    source: row.source,
    target: row.target.trim(),
    caseSensitive,
    // An import must not silently re-enable a term the user turned off; a row
    // absent from the table is the only one that starts enabled.
    enabled: existingByKey.get(key)?.enabled ?? true,
    updatedAt: now,
  })) as GlossaryTerm[]

  await db.transaction("rw", db.glossaryTerm, async () => {
    if (mode === "replace") {
      await db.glossaryTerm.where("glossaryId").equals(glossaryId).delete()
    }
    await db.glossaryTerm.bulkPut(records)
  })
  await bumpGlossaryRevision()

  return { ok: true, added, updated, duplicatesInFile, unknownLanguage }
}

/** Every term in the glossary, in every language, as a three-column CSV. */
export async function exportGlossaryCsv(glossaryId: string): Promise<string> {
  const terms = await db.glossaryTerm.where("glossaryId").equals(glossaryId).sortBy("matchKey")
  return formatGlossaryCsv(
    terms.map((term) => ({
      source: term.source,
      target: term.target,
      targetLanguage: term.targetLang,
    })),
  )
}
