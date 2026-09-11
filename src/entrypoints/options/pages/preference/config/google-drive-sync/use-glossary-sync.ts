import type { ConflictResolutions, GlossarySyncPlan } from "@/utils/glossary/sync/sync"
import { useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { restoreUndoSnapshot } from "@/utils/glossary/sync/local-store"
import { commitGlossarySync, planGlossarySync } from "@/utils/glossary/sync/sync"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { useGlossaryInvalidation } from "../../../advanced/glossary/use-glossary"

/**
 * One cast, in one place, instead of one at each of the fifteen call sites.
 *
 * The keys below are picked at runtime from a result's own tag, so the generated
 * key union cannot check them. The locale-parity test is what does.
 */
const translate = i18n.t as (key: string, substitutions?: string[]) => string

function t(key: string, substitutions?: string[]) {
  return translate(`options.preference.config.googleDrive.glossary.${key}`, substitutions)
}

/**
 * The glossary half of the Drive sync.
 *
 * A separate half, reporting separately, because the two files fail for
 * different reasons and a fault in this one must not be able to stop the config
 * from syncing — nor be swallowed by the config's own "succeeded" toast, which
 * is what copying `syncConfig`'s error-to-return-value habit would do.
 */
export function useGlossarySync() {
  const [pendingPlan, setPendingPlan] = useState<GlossarySyncPlan | null>(null)
  const invalidateGlossary = useGlossaryInvalidation()

  const commit = async (plan: GlossarySyncPlan, resolutions: ConflictResolutions) => {
    const result = await commitGlossarySync(plan, resolutions)

    if (result.status === "blocked") {
      toastManager.add({ type: "error", title: t("busy") })
      return
    }
    if (result.status === "retry") {
      toastManager.add({ type: "error", title: t("retry") })
      return
    }

    await invalidateGlossary()

    // What the sync did to THIS device, in the words the glossary screen uses.
    // The old "in/out" counted which direction each row moved, which is the
    // merge's question rather than the user's — and it counted deletions in
    // neither, so a sync that only propagated deletions read as a no-op.
    //
    // All three zero means nothing here changed, which at this point can only
    // mean the cloud took this device's copy: `planGlossarySync` returns
    // `no-change` when neither side moved, so a commit always moved something.
    const { added, updated, removed } = result.counts
    const changedHere = added + updated + removed > 0

    toastManager.add({
      type: "success",
      title:
        plan.remote === null || !changedHere
          ? t("uploaded")
          : t("merged", [String(added), String(updated), String(removed)]),
      // A snapshot plus one button, rather than a record of what each row lost:
      // less code, and it undoes a merge nobody wanted in one click instead of
      // asking the user to reconstruct it row by row.
      actionProps: {
        children: t("undo"),
        onClick: () => {
          void (async () => {
            // A refusal means the slot now belongs to something else — an
            // import, most likely, while this toast was still on screen. Said
            // out loud, because a button that does nothing at all reads as a
            // bug rather than as a refusal.
            const restored = await restoreUndoSnapshot({ source: "sync", clearBase: true })
            if (!restored) {
              toastManager.add({ type: "error", title: t("undoUnavailable") })
              return
            }
            await invalidateGlossary()
            toastManager.add({ type: "success", title: t("undone") })
          })()
        },
      },
    })
  }

  const start = async () => {
    let planned: Awaited<ReturnType<typeof planGlossarySync>>
    try {
      planned = await planGlossarySync()
    } catch (error) {
      logger.error("Glossary sync failed to plan", error)
      toastManager.add({ type: "error", title: t("failed") })
      return
    }

    if (planned.status === "no-change") {
      toastManager.add({ type: "success", title: t("upToDate") })
      return
    }

    if (planned.status === "blocked") {
      toastManager.add({
        type: "error",
        title:
          planned.reason === "cap-exceeded"
            ? t("capExceeded", [String(planned.overflowBy ?? 0)])
            : t(
                planned.reason === "version-too-new"
                  ? "versionTooNew"
                  : planned.reason === "duplicate-files"
                    ? "duplicateFiles"
                    : planned.reason === "busy"
                      ? "busy"
                      : "malformed",
              ),
      })
      return
    }

    // Anything the user has to look at — a first sync, a large deletion, a real
    // disagreement — stops here and waits for them. Nothing has been written.
    if (planned.plan.prompts.length > 0) {
      setPendingPlan(planned.plan)
      return
    }

    try {
      await commit(planned.plan, new Map())
    } catch (error) {
      logger.error("Glossary sync failed to commit", error)
      toastManager.add({ type: "error", title: t("failed") })
    }
  }

  const confirm = async (resolutions: ConflictResolutions) => {
    const plan = pendingPlan
    setPendingPlan(null)
    if (!plan) return
    try {
      await commit(plan, resolutions)
    } catch (error) {
      logger.error("Glossary sync failed to commit", error)
      toastManager.add({ type: "error", title: t("failed") })
    }
  }

  return {
    pendingPlan,
    /** Plans a sync, and either applies it or asks first. */
    start,
    confirm,
    cancel: () => setPendingPlan(null),
  }
}
