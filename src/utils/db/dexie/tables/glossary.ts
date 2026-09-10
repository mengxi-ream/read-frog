import { Entity } from "dexie"

/**
 * One user-authored glossary: a named set of terms with its own on/off switch
 * and its own list of websites it applies to.
 *
 * Like `GlossaryTerm` this is NOT a cache table — it holds text the user typed
 * and cannot get back — so `background/db-cleanup.ts` deliberately registers no
 * cleanup job for it. Do not add one.
 */
export default class Glossary extends Entity {
  /** Dexie primary key. Never changes for the life of a glossary. */
  id!: string

  /** May be empty; the UI falls back to a placeholder rather than inventing one. */
  name!: string

  description!: string

  enabled!: boolean

  /**
   * Websites this glossary applies to, in the syntax of `utils/url-pattern.ts`.
   *
   * EMPTY MEANS EVERY SITE. The list reads as "restrict to these sites", not
   * "allow these sites", so a glossary works the moment it is created instead of
   * needing a second step. The UI says which of the two states it is in rather
   * than leaving an empty list to be read either way.
   */
  matchPatterns!: string[]

  /**
   * Creation order, which is both the order the list is shown in and the
   * precedence order when two glossaries claim the same term: the later one
   * wins, so a glossary added to override an older one does.
   */
  createdAt!: Date

  updatedAt!: Date
}
