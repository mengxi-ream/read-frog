import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Button } from "@/components/ui/base-ui/button"
import { authClient } from "@/utils/auth/auth-client"
import { i18n } from "@/utils/i18n"
import { sanitizeCustomActionNotebaseConnection } from "@/utils/notebase/connection"
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

  if (!connection) {
    return (
      <Button
        type="button"
        variant="brand"
        size="sm"
        disabled={isSessionPending || isRunning || !result}
        onClick={handleClick}
      >
        {i18n.t("action.saveToNotebase")}
      </Button>
    )
  }

  const isDisabled =
    isSessionPending || isRunning || !result || (isAuthenticated && !hasCurrentAccount) || isSaving

  return (
    <Button type="button" size="sm" variant="brand" disabled={isDisabled} onClick={handleClick}>
      {isSaving ? i18n.t("action.saveToNotebaseSaving") : i18n.t("action.saveToNotebase")}
    </Button>
  )
}
