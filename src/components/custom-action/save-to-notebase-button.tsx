import type { NoteOriginInput } from "@read-frog/definitions"
import type { SurfaceByFeature } from "@/types/analytics"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { IconBookmarkFilled, IconBookmarkPlus } from "@tabler/icons-react"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES } from "@/components/ui/selection-popover/selection-toolbar-footer-compact"
import { authClient } from "@/utils/auth/auth-client"
import { i18n } from "@/utils/i18n"
import { sanitizeCustomActionNotebaseConnection } from "@/utils/notebase/connection"
import { cn } from "@/utils/styles/utils"
import { useSaveToNotebase } from "./use-save-to-notebase"

export function SaveToNotebaseButton({
  action,
  failed,
  isRunning,
  result,
  surface,
  getNoteOrigin,
}: {
  action: SelectionToolbarCustomAction
  /** The run ended in an error: `result` is only what streamed before it, so it is not saved. */
  failed: boolean
  isRunning: boolean
  result: Record<string, unknown> | null
  surface: SurfaceByFeature["note_save"]
  /** Where the note came from, read when the save starts. */
  getNoteOrigin?: () => NoteOriginInput | null
}) {
  const connection = sanitizeCustomActionNotebaseConnection(
    action.notebaseConnection,
    action.outputSchema,
  )
  const { isPending: isSessionPending } = authClient.useSession()
  const { save, isSaving, isAuthenticated, hasCurrentAccount } = useSaveToNotebase()
  // The answer this button last saved. Each run makes a new result object, so
  // a regenerated answer or a new selection can be saved again, but the same
  // answer is not added twice.
  const [savedResult, setSavedResult] = useState<Record<string, unknown> | null>(null)
  const isSaved = result !== null && result === savedResult

  const handleClick = async () => {
    if (!result || isSaved) {
      return
    }

    const outcome = await save({
      action,
      results: [result],
      surface,
      origin: getNoteOrigin?.() ?? null,
    })
    if (outcome === "saved") {
      setSavedResult(result)
    }
  }

  const isDisabled =
    isSaved ||
    (connection
      ? isSessionPending ||
        isRunning ||
        failed ||
        !result ||
        (isAuthenticated && !hasCurrentAccount) ||
        isSaving
      : isSessionPending || isRunning || failed || !result)
  const label = isSaved
    ? i18n.t("action.saveToNotebaseSuccess")
    : connection && isSaving
      ? i18n.t("action.saveToNotebaseSaving")
      : i18n.t("action.saveToNotebase")
  const Icon = isSaved ? IconBookmarkFilled : IconBookmarkPlus

  // Shrinks with the footer: the label truncates, then gives way to an icon.
  return (
    <Button
      type="button"
      variant="brand"
      size="sm"
      className={cn("min-w-0 shrink", SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.button)}
      title={label}
      disabled={isDisabled}
      onClick={() => void handleClick()}
    >
      <Icon className={SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.icon} />
      <span className={cn("truncate", SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.label)}>
        {label}
      </span>
    </Button>
  )
}
