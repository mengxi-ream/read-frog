import type { LangCodeISO6393 } from "@read-frog/definitions"
import { Entity } from "dexie"

/**
 * A user-authored terminology entry.
 *
 * The first NON-CACHE table in this database: every other table holds
 * regenerable data, this one holds text the user typed and cannot get back.
 * Two consequences, both load-bearing:
 *   - `background/db-cleanup.ts` registers cleanup jobs per table; this table
 *     deliberately gets none. Do not add one.
 *   - the extension requests `unlimitedStorage` so the browser cannot evict
 *     IndexedDB under disk pressure.
 *
 * `id` is the Dexie primary key and never changes for the life of a row.
 * `matchKey` is the *identity* used when reconciling two devices' glossaries.
 * Keeping them separate is what makes a source-text edit an in-place update
 * rather than a cross-device delete+add — see docs/glossary-feature-plan.md D12.1.
 *
 * `matchKey` is unique within a glossary AND a target language, not across the
 * table: two glossaries may legitimately give the same term different wording,
 * and one glossary may legitimately render the same term differently for
 * Chinese and for Japanese. Deciding between two glossaries is the merge's job;
 * the language never needs deciding, because only one is ever in play.
 */
export default class GlossaryTerm extends Entity {
  id!: string

  /** The glossary this term belongs to. */
  glossaryId!: string

  /** `s:<source>` when case-sensitive, `i:<lowercased source>` otherwise. Unique per glossary and language. */
  matchKey!: string

  /**
   * The target language this wording is for.
   *
   * A term only ever reaches a prompt whose target language matches, so this is
   * a filter rather than something the matcher or the prompt sees. It also
   * means the language needs no place in the translation cache key: the global
   * target language is already hashed, and the terms that survive the filter are
   * hashed with the rendered prompt.
   */
  targetLang!: LangCodeISO6393

  source!: string

  /** Empty string means "keep the original", the #942 top ask. */
  target!: string

  caseSensitive!: boolean

  enabled!: boolean

  /** When the user last edited this row. A sync must never restamp it. */
  updatedAt!: Date
}
