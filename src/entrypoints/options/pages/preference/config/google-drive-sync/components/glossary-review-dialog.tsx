import type { GlossaryConflict } from "@/utils/glossary/sync/merge-document"
import type { ConflictResolutions, GlossarySyncPlan } from "@/utils/glossary/sync/sync"
import { useMemo, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { applyResolutions, isDestructive } from "@/utils/glossary/sync/sync"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

type Side = "local" | "remote"

/** The name to put on a conflict, taken from whichever side still has the row. */
function conflictLabel(entry: GlossaryConflict): string {
  if (entry.level === "glossary") {
    const row = entry.conflict.local ?? entry.conflict.remote ?? entry.conflict.base
    return row?.name?.trim() || i18n.t("options.advanced.glossary.untitled")
  }
  const row = entry.conflict.local ?? entry.conflict.remote ?? entry.conflict.base
  return row?.source ?? entry.conflict.key
}

function offLabel(): string {
  return i18n.t("options.preference.config.googleDrive.glossary.disabled")
}

/** What one side says, in the words the user sees on the glossary screen. */
function sideSummary(entry: GlossaryConflict, side: Side): string {
  const row = side === "local" ? entry.conflict.local : entry.conflict.remote
  if (row === undefined) return i18n.t("options.preference.config.googleDrive.glossary.deleted")

  if (entry.level === "glossary") {
    const glossary = row as { name: string; enabled: boolean }
    const name = glossary.name.trim() || i18n.t("options.advanced.glossary.untitled")
    return glossary.enabled ? name : `${name} · ${offLabel()}`
  }

  const term = row as { target: string; enabled: boolean }
  const wording =
    term.target === "" ? i18n.t("options.advanced.glossary.keepOriginal") : term.target
  return term.enabled ? wording : `${wording} · ${offLabel()}`
}

/**
 * Which side the merge already leaned towards, so the buttons open on the answer
 * the user would get by doing nothing.
 */
function defaultSide(entry: GlossaryConflict): Side {
  const resolution = JSON.stringify(entry.conflict.resolution)
  return JSON.stringify(entry.conflict.local) === resolution ? "local" : "remote"
}

export function GlossarySyncReviewDialog({
  plan,
  onCancel,
  onConfirm,
}: {
  plan: GlossarySyncPlan | null
  onCancel: () => void
  onConfirm: (resolutions: ConflictResolutions) => void
}) {
  const [choices, setChoices] = useState<Record<string, Side>>({})

  const firstSync = plan?.prompts.find((prompt) => prompt.kind === "first-sync")
  const destructive = plan?.prompts.find((prompt) => prompt.kind === "destructive")
  const conflicts = useMemo(() => {
    const prompt = plan?.prompts.find((entry) => entry.kind === "conflicts")
    return prompt?.kind === "conflicts" ? prompt.conflicts : []
  }, [plan])

  const resolutions = useMemo(() => {
    const map: ConflictResolutions = new Map()
    for (const entry of conflicts) {
      const choice = choices[entry.conflict.key]
      if (choice) map.set(entry.conflict.key, choice)
    }
    return map
  }, [conflicts, choices])

  /**
   * The gate, re-measured against the answers given so far.
   *
   * The plan's own `destructive` prompt was computed before the user touched
   * anything, so resolving conflicts towards the deleting side can walk a sync
   * past a warning that was true when it was calculated and is not any more.
   * Recomputing here keeps one dialog and one Confirm button: the paragraph
   * simply appears, with the real count, as soon as the choices earn it.
   */
  const resolved = useMemo(
    () => (plan && resolutions.size ? applyResolutions(plan.merge, resolutions) : plan?.merge),
    [plan, resolutions],
  )
  const removing = resolved?.stats.localRowsRemoved ?? 0
  const total = resolved?.stats.localRowsTotal ?? 0
  const showDestructive = destructive?.kind === "destructive" || isDestructive(removing, total)

  const close = () => {
    setChoices({})
    onCancel()
  }

  return (
    <AlertDialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t("options.preference.config.googleDrive.glossary.review.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {firstSync?.kind === "first-sync"
              ? i18n.t("options.preference.config.googleDrive.glossary.review.firstSync", [
                  String(firstSync.incoming),
                  String(firstSync.outgoing),
                ])
              : i18n.t("options.preference.config.googleDrive.glossary.review.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* The account changed under this device. Said out loud because the merge
            is about to put terms built under the previous account into this
            one's Drive, and switching accounts is often done to keep them
            apart — so the way out is spelled out rather than left to be
            guessed at. */}
        {firstSync?.kind === "first-sync" && firstSync.accountChanged && (
          <p className="rounded-md border bg-muted/40 p-2.5 text-sm">
            {i18n.t("options.preference.config.googleDrive.glossary.review.accountChanged", [
              firstSync.email,
              String(firstSync.outgoing),
            ])}
          </p>
        )}

        {/* Its own paragraph, not a line in the description: this is the only
            thing on the screen that can cost the user data, and every
            catastrophic path this design was reviewed against ends here. */}
        {showDestructive && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
            {i18n.t("options.preference.config.googleDrive.glossary.review.destructive", [
              String(removing),
              String(total),
            ])}
          </p>
        )}

        {conflicts.length > 0 && (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {conflicts.map((entry) => {
              const key = entry.conflict.key
              const selected = choices[key] ?? defaultSide(entry)
              return (
                <div key={key} className="flex flex-col gap-1.5 rounded-md border p-2.5">
                  <span className="text-sm font-medium">{conflictLabel(entry)}</span>
                  <div className="flex flex-wrap gap-2">
                    {(["local", "remote"] as const).map((side) => (
                      <Button
                        key={side}
                        size="sm"
                        variant={selected === side ? "default" : "outline"}
                        className={cn("h-auto min-w-0 flex-1 flex-col items-start gap-0.5 py-1.5")}
                        onClick={() => setChoices((current) => ({ ...current, [key]: side }))}
                      >
                        <span className="text-[11px] opacity-70">
                          {side === "local"
                            ? i18n.t("options.preference.config.googleDrive.glossary.thisDevice")
                            : i18n.t("options.preference.config.googleDrive.glossary.cloud")}
                        </span>
                        <span className="w-full truncate text-left text-xs">
                          {sideSummary(entry, side)}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>
            {i18n.t("options.preference.config.googleDrive.glossary.review.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setChoices({})
              onConfirm(resolutions)
            }}
          >
            {i18n.t("options.preference.config.googleDrive.glossary.review.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
