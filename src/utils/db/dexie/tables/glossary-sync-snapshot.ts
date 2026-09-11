import type { SyncedGlossary, SyncedTerm } from "@/utils/glossary/sync/document"
import { Entity } from "dexie"

/**
 * The two whole-glossary snapshots the Drive sync keeps, under two fixed ids.
 *
 * `base` is what this device last agreed with the cloud: the rows exactly as
 * they were uploaded or downloaded. It is the merge base, and without it "this
 * device has a row the cloud does not" cannot be told apart from "the other
 * device deleted that row" — a sync that guesses loses data in one of the two.
 * It is per device, never uploaded, and it carries the Google account it belongs
 * to, so signing into a different account cannot be mistaken for the cloud
 * having lost everything.
 *
 * `undo` is the local rows as they stood immediately before the last merge was
 * applied, so one click puts them back. Cheaper than recording what each row
 * lost, and strictly more useful.
 *
 * Whole rows, not hashes. A hash would make a field-level merge impossible and
 * an honest conflict report impossible — after the merge the losing value would
 * exist nowhere — while saving far less than it appears to, since a row is
 * mostly its uuid and its two short strings.
 *
 * Like the glossary tables this is NOT a cache table, and `db-cleanup.ts`
 * deliberately registers no job for it: dropping the base silently turns the
 * next sync into a first sync.
 */
export default class GlossarySyncSnapshot extends Entity {
  /** `base` or `undo`. */
  id!: string

  /** The Google account this snapshot belongs to. Empty on an `undo` row. */
  email!: string

  capturedAt!: Date

  glossaries!: SyncedGlossary[]

  terms!: SyncedTerm[]
}

export const GLOSSARY_SYNC_BASE_ID = "base"
export const GLOSSARY_SYNC_UNDO_ID = "undo"
