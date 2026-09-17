import { z } from "zod"

/**
 * The glossary travels in its OWN Drive file, beside `read-frog-config.json`.
 *
 * Not inside the config, for three reasons that are all properties of the config
 * sync rather than opinions: it treats every array as one atomic value
 * (`conflict-merge.ts`), so two devices adding different terms would be a
 * conflict the user resolves by throwing one side away; it opens its dialog even
 * for a change only one side made; and it re-parses the whole config against its
 * schema on every sync, which at 20,000 terms is work nobody asked for.
 *
 * `api.ts` takes the filename as an argument everywhere, and the `drive.appdata`
 * scope is granted per folder rather than per file, so a second file costs no
 * code there and no new consent from the user.
 */
export const GLOSSARY_SYNC_FILENAME = "read-frog-glossary.json"

/**
 * Bumped only for a change a previous version could not read correctly.
 *
 * A device seeing a HIGHER number aborts the whole sync rather than merging what
 * it understands: a merge that silently drops a field it has never heard of
 * would upload the result and destroy that field everywhere.
 */
export const GLOSSARY_SYNC_SCHEMA_VERSION = 1

const isoDate = z
  .string()
  .min(1)
  .transform((value) => new Date(value))
  .refine((value) => !Number.isNaN(value.getTime()), { message: "invalid date" })

const glossarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  matchPatterns: z.array(z.string()),
  createdAt: isoDate,
  updatedAt: isoDate,
})

const termSchema = z.object({
  id: z.string().min(1),
  glossaryId: z.string().min(1),
  matchKey: z.string().min(1),
  /**
   * Deliberately NOT validated against the language list. A newer version of the
   * extension may write a value this one has never heard of — `all` is the first
   * — and rejecting the document over it would turn a forward-compatible field
   * into a sync that refuses to run. The value is opaque to the merge: it is
   * part of a term's identity and nothing here reads it.
   */
  targetLang: z.string().min(1),
  source: z.string().min(1),
  target: z.string(),
  caseSensitive: z.boolean(),
  enabled: z.boolean(),
  updatedAt: isoDate,
})

const documentSchema = z.object({
  schemaVersion: z.number().int().positive(),
  glossaries: z.array(glossarySchema),
  terms: z.array(termSchema),
})

/**
 * The rows as the merge sees them: the Dexie columns and nothing else.
 *
 * Declared here rather than reused from the table classes so that no part of the
 * merge depends on Dexie — those classes extend `Entity`, which carries a `db`
 * and a `table` the merge has no business holding, and a merged row is built by
 * copying fields rather than by being read out of a store. A Dexie row is
 * assignable to these; the other direction is the repository's job.
 */
export interface SyncedGlossary {
  id: string
  name: string
  description: string
  enabled: boolean
  matchPatterns: string[]
  createdAt: Date
  updatedAt: Date
}

export interface SyncedTerm {
  id: string
  glossaryId: string
  matchKey: string
  /** A plain string on purpose — see the schema note above. */
  targetLang: string
  source: string
  target: string
  caseSensitive: boolean
  enabled: boolean
  updatedAt: Date
}

export interface GlossarySyncDocument {
  schemaVersion: number
  glossaries: SyncedGlossary[]
  terms: SyncedTerm[]
}

export type ParseGlossaryDocumentResult =
  | { ok: true; document: GlossarySyncDocument }
  | { ok: false; reason: "malformed" | "version-too-new" }

/**
 * Reads a downloaded document.
 *
 * The two failures are kept apart because they mean opposite things to the
 * caller: a version we cannot read is a healthy file this build must not touch,
 * while malformed is a file that should never have been written. Neither may be
 * treated as "the cloud is empty" — that reading is what wipes a glossary.
 */
export function parseGlossaryDocument(content: string): ParseGlossaryDocumentResult {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    return { ok: false, reason: "malformed" }
  }
  return readGlossaryDocument(raw)
}

/**
 * The same read, for a document that arrived already parsed — the glossary
 * carried inside an exported settings file. One schema and one version check for
 * both routes, so a file written by either can be read by either.
 */
export function readGlossaryDocument(raw: unknown): ParseGlossaryDocumentResult {
  const parsed = documentSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: "malformed" }
  if (parsed.data.schemaVersion > GLOSSARY_SYNC_SCHEMA_VERSION) {
    return { ok: false, reason: "version-too-new" }
  }

  return {
    ok: true,
    document: {
      schemaVersion: parsed.data.schemaVersion,
      glossaries: parsed.data.glossaries,
      terms: parsed.data.terms,
    },
  }
}

/** What gets uploaded. Dates become ISO strings; nothing else changes. */
export function formatGlossaryDocument(document: {
  glossaries: readonly SyncedGlossary[]
  terms: readonly SyncedTerm[]
}): string {
  return JSON.stringify(buildGlossaryDocument(document), null, 2)
}

/** The same payload as a value, for embedding in an exported settings file. */
export function buildGlossaryDocument(document: {
  glossaries: readonly SyncedGlossary[]
  terms: readonly SyncedTerm[]
}) {
  return {
    schemaVersion: GLOSSARY_SYNC_SCHEMA_VERSION,
    glossaries: document.glossaries.map((glossary) => ({
      id: glossary.id,
      name: glossary.name,
      description: glossary.description,
      enabled: glossary.enabled,
      matchPatterns: glossary.matchPatterns,
      createdAt: glossary.createdAt.toISOString(),
      updatedAt: glossary.updatedAt.toISOString(),
    })),
    terms: document.terms.map((term) => ({
      id: term.id,
      glossaryId: term.glossaryId,
      matchKey: term.matchKey,
      targetLang: term.targetLang,
      source: term.source,
      target: term.target,
      caseSensitive: term.caseSensitive,
      enabled: term.enabled,
      updatedAt: term.updatedAt.toISOString(),
    })),
  }
}
