import type { SyncedGlossary, SyncedTerm } from "./document"
import type { GlossaryChangeCounts, GlossaryConflict, GlossaryMerge } from "./merge-document"
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
import { mergeGlossaryDocuments, termIdentity, withDistinctIds } from "./merge-document"

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

const LOCK_NAME = "read-frog:glossary-sync"

/**
 * A mutex, because `isSyncing` is React state in one tab and the options page
 * can be open in several.
 *
 * Without it two tabs that both find no file both create one, and from then on
 * each device is bound to a different file and neither ever sees the other's
 * terms.
 *
 * `navigator.locks` rather than a lease in `storage`: a read-then-write lease is
 * not atomic, so two tabs can interleave until each re-read sees its own write
 * and both believe they hold it — which is precisely the case it exists to
 * prevent. The Web Locks API is genuinely exclusive across tabs of the origin,
 * needs no TTL to guess at how long a sync should take (a 20,000-term upload on
 * a poor connection must not have its lock stolen), and releases on its own when
 * a tab closes mid-sync.
 *
 * `ifAvailable` so a second tab is told it is busy rather than queueing behind a
 * sync whose plan will be stale by the time it runs.
 */
async function withSyncLock<T>(run: () => Promise<T>, onBusy: () => T): Promise<T> {
  return navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
    if (!lock) return onBusy()
    return run()
  })
}

export type SyncPrompt =
  /**
   * Two independently built glossaries meeting for the first time. The moment
   * that actually matters, so it is shown even though nothing is in conflict.
   *
   * `accountChanged` separates "this device has never synced" from "this device
   * synced, as somebody else". The second is the one that needs saying out loud:
   * the merge is about to put terms built under the previous account into THIS
   * account's Drive, and the user may have switched precisely to keep the two
   * apart.
   */
  | {
      kind: "first-sync"
      incoming: number
      outgoing: number
      conflicts: number
      accountChanged: boolean
      email: string
    }
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
      reason:
        | "malformed"
        | "version-too-new"
        | "duplicate-files"
        | "cap-exceeded"
        | "busy"
        | "account-changed"
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
export async function planGlossarySync({
  token,
  expectedEmail,
}: {
  /** The token the click already resolved, so both halves reach one Drive. */
  token?: string
  /** The account that click was made under, when the plan is running later. */
  expectedEmail?: string
} = {}): Promise<PlanGlossarySyncResult> {
  // `getValidAccessToken` re-authenticates inside a 60s buffer and asks which
  // account to use, so resolving it again per half is how one click ended up
  // writing the config to one account and the glossary to another.
  const accessToken = token ?? (await getValidAccessToken())
  const { email } = await getGoogleUserInfo(accessToken)

  // The deferred half — the one that waits for the config dialog to close —
  // cannot reuse the token, because that dialog can sit open past its expiry.
  // It can still be held to the ACCOUNT, which is the part that matters: a
  // fresh token for whoever happens to be signed in now would plan and commit
  // against them, and `commitGlossarySync`'s own check would pass, because the
  // plan it compares against was built under the wrong account too.
  if (expectedEmail !== undefined && email !== expectedEmail) {
    logger.warn("Google account changed before the glossary sync could start")
    return { status: "blocked", reason: "account-changed" }
  }

  const [local, storedBase, remote] = await Promise.all([
    readLocalGlossary(),
    readSyncBase(),
    readRemoteGlossary(accessToken),
  ])

  if (remote.status === "unreadable") {
    return { status: "blocked", reason: remote.reason }
  }

  const localFingerprint = fingerprint(local)

  // Worked out before the branch below, not inside it: an account change has to
  // be noticed whether or not the new account already has a file, and reading
  // the absent case first is how it went unnoticed.
  const accountChanged = storedBase !== null && storedBase.email !== email
  const isFirstSync = storedBase === null || accountChanged

  if (remote.status === "absent") {
    if (local.glossaries.length === 0 && local.terms.length === 0) {
      return { status: "no-change" }
    }
    const outgoing = local.glossaries.length + local.terms.length
    // Nothing to reconcile against, and above all nothing to delete: an absent
    // file is not an empty glossary. It still gets a prompt when the account
    // changed, because "upload everything this device has into the account you
    // just switched to" is not something to do without saying so.
    return {
      status: "ready",
      plan: {
        email,
        fingerprint: localFingerprint,
        remote: null,
        prompts: accountChanged
          ? [{ kind: "first-sync", incoming: 0, outgoing, conflicts: 0, accountChanged, email }]
          : [],
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
      },
    }
  }

  // A base belonging to another account describes an agreement with a different
  // cloud. Using it would read that account's rows as this one's deletions —
  // "log out, sign in with the work account" must not be two clicks to replace
  // 4,000 terms with 12.
  const usableBase = isFirstSync ? { glossaries: [], terms: [] } : storedBase.snapshot

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
  // A first sync still has to be committed even when it moves nothing, because
  // committing is what records the base. A device set up from the same exported
  // file already agrees with the cloud, so every statistic is zero — and without
  // a base the NEXT sync is a first sync too, which reads a term the user has
  // since deleted as one arriving from the cloud and puts it back.
  if (nothingMoved && !isFirstSync) return { status: "no-change" }

  const prompts: SyncPrompt[] = []
  // Nothing to tell the user about when nothing moved; the commit runs anyway,
  // silently, for the base.
  if (isFirstSync && !nothingMoved) {
    prompts.push({
      kind: "first-sync",
      incoming: stats.glossaries.incoming + stats.terms.incoming,
      outgoing: stats.glossaries.outgoing + stats.terms.outgoing,
      conflicts: merged.merge.conflicts.length,
      accountChanged,
      email,
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
  /** `counts` is what the write did to this device, measured against the rows it replaced. */
  | { status: "applied"; merge: GlossaryMerge; counts: GlossaryChangeCounts }
  | { status: "retry"; reason: "changed-underneath" | "changed-locally" | "account-changed" }
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
  return withSyncLock<CommitGlossarySyncResult>(
    async () => {
      // The plan named an account, and everything after this writes to whichever
      // one the token now belongs to. A review dialog can sit open past the
      // token's expiry, and re-authenticating asks which account to use; another
      // tab can switch accounts outright. Uploading this device's glossary into
      // an account the user did not plan for is the exact thing the
      // account-change prompt exists to stop, and it would then be recorded
      // under `plan.email` as though the old account had agreed to it.
      const accessToken = await getValidAccessToken()
      const { email } = await getGoogleUserInfo(accessToken)
      if (email !== plan.email) {
        logger.warn("Google account changed between planning and committing the glossary sync")
        return { status: "retry", reason: "account-changed" }
      }

      const merge = resolutions?.size ? applyResolutions(plan.merge, resolutions) : plan.merge
      const payload = { glossaries: merge.glossaries, terms: merge.terms }

      // The verified token, not a fresh lookup: `writeRemoteGlossary` and the
      // helpers under it would each resolve their own, so the check above would
      // bind nothing and the write could still land in another account.
      const written = await writeRemoteGlossary(payload, plan.remote, accessToken)
      if (!written.ok) return { status: "retry", reason: "changed-underneath" }

      let counts: GlossaryChangeCounts
      try {
        counts = await applyMergedGlossary({
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

      return { status: "applied", merge, counts }
    },
    () => ({ status: "blocked", reason: "busy" }),
  )
}

/**
 * Swaps in the side the user picked for each conflict.
 *
 * A choice of `remote` on a row the cloud deleted means letting the delete
 * through, so the row leaves the output entirely rather than being replaced.
 *
 * Terms are keyed with `termIdentity`, the same function that produced the
 * conflict keys. A second key builder written to look the same is how the user's
 * answers stopped matching the rows they were asked about: `set` added a second
 * row for one `(glossaryId, targetLang, matchKey)` triple instead of replacing
 * the first — which the unique index rejects, after the upload — and `delete`
 * matched nothing, so a delete the user chose never happened.
 */
export function applyResolutions(
  merge: GlossaryMerge,
  resolutions: ConflictResolutions,
): GlossaryMerge {
  const glossaries = new Map(merge.glossaries.map((row) => [row.id, row]))
  const terms = new Map(merge.terms.map((row) => [termIdentity(row), row]))
  const droppedGlossaries = new Set<string>()
  // Of those, the ones this device actually had — so their terms can be counted
  // as rows lost, while a glossary only the cloud held costs this device none.
  const droppedLocalGlossaries = new Set<string>()

  // Only rows THIS DEVICE holds count towards the destructive gate, so a
  // released row is counted by whether the conflict had a local side — never by
  // differencing output lengths. Choosing "this device" on a glossary the user
  // deleted and the cloud edited drops the cloud's whole copy, which can be
  // thousands of rows this device never had: differencing counts every one of
  // them, the clamp below then reports it as the entire local library, and the
  // user is told a sync that loses them nothing is about to erase everything.
  let removedByUser = 0

  for (const entry of merge.conflicts) {
    const choice = resolutions.get(entry.conflict.key)
    if (!choice) continue

    if (entry.level === "glossary") {
      const chosen = choice === "local" ? entry.conflict.local : entry.conflict.remote
      if (chosen === undefined) {
        glossaries.delete(entry.conflict.key)
        droppedGlossaries.add(entry.conflict.key)
        if (entry.conflict.local !== undefined) {
          // This device had the glossary, so it had rows in it. Its terms are
          // counted below, once, as they are filtered out.
          droppedLocalGlossaries.add(entry.conflict.key)
          removedByUser++
        }
        continue
      }
      // The side the user picked, with what the merge worked out about the
      // things they were not asked about. The dialog offers a NAME, so taking
      // the raw row would also silently revert this glossary's website list to
      // one device's copy — throwing away the union the merge just built, which
      // is the same loss the no-base union exists to prevent.
      const merged = glossaries.get(chosen.id)
      glossaries.set(
        chosen.id,
        merged
          ? {
              ...chosen,
              matchPatterns: merged.matchPatterns,
              createdAt: merged.createdAt,
              updatedAt: merged.updatedAt,
            }
          : chosen,
      )
      continue
    }

    const chosen = choice === "local" ? entry.conflict.local : entry.conflict.remote
    if (chosen === undefined) {
      terms.delete(entry.conflict.key)
      if (entry.conflict.local !== undefined) removedByUser++
    } else {
      terms.set(entry.conflict.key, chosen)
    }
  }

  const resolvedGlossaries = [...glossaries.values()]
  const allTerms = [...terms.values()]
  // A glossary the user chose to delete takes its terms with it, the same way
  // deleting one in the options page does. Those of its terms this device held
  // are rows it loses, so they join the count above.
  const survives = (term: SyncedTerm) => !droppedGlossaries.has(term.glossaryId)
  removedByUser += allTerms.filter(
    (term) => !survives(term) && droppedLocalGlossaries.has(term.glossaryId),
  ).length

  // Raw side rows carry their own uuids, so swapping one in can put two terms
  // back under a single Dexie primary key — the invariant `mergeGlossaryDocuments`
  // established and this function would otherwise quietly undo, one call before
  // the payload is uploaded and `bulkPut` drops all but the last of the pair.
  const resolvedTerms = withDistinctIds(allTerms.filter(survives))

  return {
    ...merge,
    glossaries: resolvedGlossaries,
    terms: resolvedTerms,
    stats: {
      ...merge.stats,
      glossaries: { ...merge.stats.glossaries },
      terms: { ...merge.stats.terms },
      localRowsRemoved: Math.min(
        merge.stats.localRowsRemoved + removedByUser,
        merge.stats.localRowsTotal,
      ),
    },
  }
}

export type { SyncedGlossary, SyncedTerm }
