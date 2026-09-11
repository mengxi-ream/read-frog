import type { SyncedGlossary, SyncedTerm } from "./document"
import type { GlossaryConflict, GlossaryMerge } from "./merge-document"
import { storage } from "#imports"
import { getGoogleUserInfo, getValidAccessToken } from "@/utils/google-drive/auth"
import { logger } from "@/utils/logger"
import { readRemoteGlossary, writeRemoteGlossary } from "./drive-store"
import {
  applyMergedGlossary,
  fingerprint,
  GlossaryChangedDuringSyncError,
  readLocalGlossary,
  readSyncBase,
} from "./local-store"
import { mergeGlossaryDocuments } from "./merge-document"

/**
 * A merge that removes more than this much of what the device holds is not
 * applied without the user reading a sentence about it first.
 *
 * Every catastrophic path the review of this design turned up ends the same way
 * — "and then it deleted everything" — so one gate in front of large deletions
 * catches all of them, including the ones nobody has thought of. Two thresholds
 * because a percentage alone lets a 5-term glossary vanish silently, and a count
 * alone lets a 20,000-term one lose 3,000.
 */
const DESTRUCTIVE_ROW_COUNT = 50
const DESTRUCTIVE_ROW_FRACTION = 0.2

const LOCK_KEY = "local:glossarySyncLock" as const
const LOCK_TTL_MS = 2 * 60 * 1000

interface Lock {
  owner: string
  takenAt: number
}

/**
 * A lease, because `isSyncing` is React state in one tab and the options page
 * can be open in several.
 *
 * Without it two tabs that both find no file both create one, and from then on
 * each device is bound to a different file and neither ever sees the other's
 * terms. It is a lease rather than a flag so that a tab closed mid-sync cannot
 * lock the feature until the browser restarts.
 */
async function acquireLock(owner: string): Promise<boolean> {
  const held = await storage.getItem<Lock>(LOCK_KEY)
  if (held && Date.now() - held.takenAt < LOCK_TTL_MS) return false
  await storage.setItem<Lock>(LOCK_KEY, { owner, takenAt: Date.now() })
  // Re-read: two tabs can pass the check above in the same tick, and the one
  // whose write landed last is the one that owns it.
  const now = await storage.getItem<Lock>(LOCK_KEY)
  return now?.owner === owner
}

async function releaseLock(owner: string): Promise<void> {
  const held = await storage.getItem<Lock>(LOCK_KEY)
  if (held?.owner === owner) await storage.removeItem(LOCK_KEY)
}

export type SyncPrompt =
  /**
   * Two independently built glossaries meeting for the first time. The moment
   * that actually matters, so it is shown even though nothing is in conflict.
   */
  | { kind: "first-sync"; incoming: number; outgoing: number; conflicts: number }
  | { kind: "destructive"; removing: number; total: number }
  | { kind: "conflicts"; conflicts: GlossaryConflict[] }

export interface GlossarySyncPlan {
  email: string
  /** What the local tables looked like when the merge was computed. */
  fingerprint: string
  /** Null when the cloud has no file yet: upload, and delete nothing. */
  remote: { fileId: string; modifiedTime: string } | null
  merge: GlossaryMerge
  prompts: SyncPrompt[]
}

export type PlanGlossarySyncResult =
  | { status: "ready"; plan: GlossarySyncPlan }
  | { status: "no-change" }
  | {
      status: "blocked"
      reason: "malformed" | "version-too-new" | "duplicate-files" | "cap-exceeded" | "busy"
      overflowBy?: number
    }

const EMPTY_STATS = { incoming: 0, outgoing: 0, removed: 0, unchanged: 0 }

/**
 * Works out what a sync would do, without doing any of it.
 *
 * Split from `commitGlossarySync` so the dialogs have something to show: every
 * decision the user might be asked for is in `prompts`, and nothing has been
 * written to the cloud or to Dexie when this returns.
 */
export async function planGlossarySync(): Promise<PlanGlossarySyncResult> {
  // Once, at the top. `getValidAccessToken` re-authenticates inside a 60s buffer
  // and asks which account to use, so taking it twice in one sync can bind the
  // two halves to two different Google accounts.
  const accessToken = await getValidAccessToken()
  const { email } = await getGoogleUserInfo(accessToken)

  const [local, storedBase, remote] = await Promise.all([
    readLocalGlossary(),
    readSyncBase(),
    readRemoteGlossary(),
  ])

  if (remote.status === "unreadable") {
    return { status: "blocked", reason: remote.reason }
  }

  const localFingerprint = fingerprint(local)

  if (remote.status === "absent") {
    if (local.glossaries.length === 0 && local.terms.length === 0) {
      return { status: "no-change" }
    }
    // Nothing to reconcile against, and above all nothing to delete: an absent
    // file is not an empty glossary.
    return {
      status: "ready",
      plan: {
        email,
        fingerprint: localFingerprint,
        remote: null,
        merge: {
          glossaries: [...local.glossaries],
          terms: [...local.terms],
          conflicts: [],
          stats: {
            glossaries: { ...EMPTY_STATS, outgoing: local.glossaries.length },
            terms: { ...EMPTY_STATS, outgoing: local.terms.length },
            localRowsRemoved: 0,
            localRowsTotal: local.glossaries.length + local.terms.length,
          },
        },
        prompts: [],
      },
    }
  }

  // A base belonging to another account describes an agreement with a different
  // cloud. Using it would read that account's rows as this one's deletions —
  // "log out, sign in with the work account" must not be two clicks to replace
  // 4,000 terms with 12.
  const usableBase =
    storedBase?.email === email ? storedBase.snapshot : { glossaries: [], terms: [] }
  const isFirstSync = storedBase === null || storedBase.email !== email

  const merged = mergeGlossaryDocuments({
    base: usableBase,
    local,
    remote: remote.document,
  })

  if (!merged.ok) {
    return { status: "blocked", reason: "cap-exceeded", overflowBy: merged.overflowBy }
  }

  const { stats } = merged.merge
  const nothingMoved =
    stats.glossaries.incoming === 0 &&
    stats.glossaries.outgoing === 0 &&
    stats.glossaries.removed === 0 &&
    stats.terms.incoming === 0 &&
    stats.terms.outgoing === 0 &&
    stats.terms.removed === 0
  if (nothingMoved) return { status: "no-change" }

  const prompts: SyncPrompt[] = []
  if (isFirstSync) {
    prompts.push({
      kind: "first-sync",
      incoming: stats.glossaries.incoming + stats.terms.incoming,
      outgoing: stats.glossaries.outgoing + stats.terms.outgoing,
      conflicts: merged.merge.conflicts.length,
    })
  }
  if (isDestructive(stats.localRowsRemoved, stats.localRowsTotal)) {
    prompts.push({
      kind: "destructive",
      removing: stats.localRowsRemoved,
      total: stats.localRowsTotal,
    })
  }
  if (merged.merge.conflicts.length > 0) {
    prompts.push({ kind: "conflicts", conflicts: merged.merge.conflicts })
  }

  return {
    status: "ready",
    plan: {
      email,
      fingerprint: localFingerprint,
      remote: { fileId: remote.fileId, modifiedTime: remote.modifiedTime },
      merge: merged.merge,
      prompts,
    },
  }
}

export function isDestructive(removing: number, total: number): boolean {
  if (removing === 0) return false
  return removing > DESTRUCTIVE_ROW_COUNT || removing > total * DESTRUCTIVE_ROW_FRACTION
}

/** Which side of a conflict the user chose, by the conflict's key. */
export type ConflictResolutions = Map<string, "local" | "remote">

export type CommitGlossarySyncResult =
  | { status: "applied"; merge: GlossaryMerge }
  | { status: "retry"; reason: "changed-underneath" | "changed-locally" }
  | { status: "blocked"; reason: "busy" }

/**
 * Applies the plan: upload first, then the local rows and the base together.
 *
 * The order is the load-bearing part. `base` must be set from what was uploaded
 * and never from a re-read afterwards, and it must not be written at all unless
 * the upload succeeded — a base claiming agreement the cloud never saw makes the
 * rows behind it permanently invisible to sync.
 */
export async function commitGlossarySync(
  plan: GlossarySyncPlan,
  resolutions?: ConflictResolutions,
): Promise<CommitGlossarySyncResult> {
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  if (!(await acquireLock(owner))) return { status: "blocked", reason: "busy" }

  try {
    const merge = resolutions?.size ? applyResolutions(plan.merge, resolutions) : plan.merge
    const payload = { glossaries: merge.glossaries, terms: merge.terms }

    const written = await writeRemoteGlossary(payload, plan.remote)
    if (!written.ok) return { status: "retry", reason: "changed-underneath" }

    try {
      await applyMergedGlossary({
        glossaries: payload.glossaries,
        terms: payload.terms,
        email: plan.email,
        expectedFingerprint: plan.fingerprint,
      })
    } catch (error) {
      if (error instanceof GlossaryChangedDuringSyncError) {
        // The cloud now holds the merge, this device does not, and its base
        // still describes the old agreement — so the next sync merges the two
        // and converges. Nothing is lost; the user just runs it again.
        logger.warn("Glossary changed during sync; leaving the local rows alone")
        return { status: "retry", reason: "changed-locally" }
      }
      throw error
    }

    return { status: "applied", merge }
  } finally {
    await releaseLock(owner)
  }
}

/**
 * Swaps in the side the user picked for each conflict.
 *
 * A choice of `remote` on a row the cloud deleted means letting the delete
 * through, so the row leaves the output entirely rather than being replaced.
 */
export function applyResolutions(
  merge: GlossaryMerge,
  resolutions: ConflictResolutions,
): GlossaryMerge {
  const glossaries = new Map(merge.glossaries.map((row) => [row.id, row]))
  const terms = new Map(merge.terms.map((row) => [termKey(row), row]))
  const droppedGlossaries = new Set<string>()

  for (const entry of merge.conflicts) {
    const choice = resolutions.get(entry.conflict.key)
    if (!choice) continue

    if (entry.level === "glossary") {
      const chosen = choice === "local" ? entry.conflict.local : entry.conflict.remote
      if (chosen === undefined) {
        glossaries.delete(entry.conflict.key)
        droppedGlossaries.add(entry.conflict.key)
      } else {
        glossaries.set(chosen.id, chosen)
      }
      continue
    }

    const chosen = choice === "local" ? entry.conflict.local : entry.conflict.remote
    if (chosen === undefined) terms.delete(entry.conflict.key)
    else terms.set(entry.conflict.key, chosen)
  }

  return {
    ...merge,
    glossaries: [...glossaries.values()],
    // A glossary the user chose to delete takes its terms with it, the same way
    // deleting one in the options page does.
    terms: [...terms.values()].filter((term) => !droppedGlossaries.has(term.glossaryId)),
  }
}

function termKey(term: SyncedTerm): string {
  return `${term.glossaryId} ${term.targetLang} ${term.matchKey}`
}

export type { SyncedGlossary, SyncedTerm }
