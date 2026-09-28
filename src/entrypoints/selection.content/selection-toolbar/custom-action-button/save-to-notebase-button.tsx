import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { IconBookmarkPlus } from "@tabler/icons-react"
import { Button } from "@/components/ui/base-ui/button"
import { authClient } from "@/utils/auth/auth-client"
import { i18n } from "@/utils/i18n"
import { sanitizeCustomActionNotebaseConnection } from "@/utils/notebase/connection"
import { cn } from "@/utils/styles/utils"
import { SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES } from "../../components/selection-toolbar-footer-compact"
import { useSaveToNotebase } from "./use-save-to-notebase"

export function SaveToNotebaseButton({
  action,
  isRunning,
  result,
}: {
  action: SelectionToolbarCustomAction
  isRunning: boolean
  result: Record<string, unknown> | null
}) {
  const connection = sanitizeCustomActionNotebaseConnection(
    action.notebaseConnection,
    action.outputSchema,
  )
  const { isPending: isSessionPending } = authClient.useSession()
  const { save, isSaving, isAuthenticated, hasCurrentAccount } = useSaveToNotebase()

  const handleClick = () => {
    if (!result) {
      return
    }

    void save({ action, results: [result] })
  }

  const isDisabled = connection
    ? isSessionPending ||
      isRunning ||
      !result ||
      (isAuthenticated && !hasCurrentAccount) ||
      isSaving
    : isSessionPending || isRunning || !result
  const label =
    connection && isSaving ? i18n.t("action.saveToNotebaseSaving") : i18n.t("action.saveToNotebase")

  // Shrinks with the footer: the label truncates, then gives way to an icon.
  return (
    <Button
      type="button"
      variant="brand"
      size="sm"
      className={cn("min-w-0 shrink", SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.button)}
      title={label}
      disabled={isDisabled}
      onClick={handleClick}
    >
      <IconBookmarkPlus className={SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.icon} />
      <span className={cn("truncate", SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.label)}>
        {label}
      </span>
    </Button>
  )
}
