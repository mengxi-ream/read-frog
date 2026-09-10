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
 * `matchKey` is unique WITHIN a glossary, not across the table: two glossaries
 * may legitimately give the same term different wording, and deciding between
 * them is the merge's job, not the storage layer's.
 */
export default class GlossaryTerm extends Entity {
  id!: string

  /** The glossary this term belongs to. */
  glossaryId!: string

  /** `s:<source>` when case-sensitive, `i:<lowercased source>` otherwise. Unique per glossary. */
  matchKey!: string

  source!: string

  /** Empty string means "keep the original", the #942 top ask. */
  target!: string

  caseSensitive!: boolean

  enabled!: boolean

  /** When the user last edited this row. A sync must never restamp it. */
  updatedAt!: Date
}
