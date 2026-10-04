import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { CustomActionResultStorageProvider } from "@/utils/custom-action-result-storage/types"
import { IconBookmarkPlus } from "@tabler/icons-react"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { toastManager } from "@/components/ui/base-ui/toast"
import { SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES } from "@/components/ui/selection-popover/selection-toolbar-footer-compact"
import { authClient } from "@/utils/auth/auth-client"
import { getSourceDocumentTitle } from "@/utils/content/document-title"
import { getCustomActionResultStorageErrorMessage } from "@/utils/custom-action-result-storage/error-message"
import { useCustomActionResultStorageProvider } from "@/utils/custom-action-result-storage/use-storage-provider"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { sanitizeCustomActionNotebaseConnection } from "@/utils/notebase/connection"
import { cn } from "@/utils/styles/utils"
import { useSaveToNotebase } from "./use-save-to-notebase"

interface SaveButtonProps {
  action: SelectionToolbarCustomAction
  isRunning: boolean
  result: Record<string, unknown> | null
}

export function SaveToNotebaseButton(props: SaveButtonProps) {
  const provider = useCustomActionResultStorageProvider()

  // Do not mount auth or Notebase hooks until the extension-local preference
  // has loaded. A local/WebDAV preference therefore does not trigger a session
  // check just by rendering the Custom Action result.
  if (provider === null) {
    return <SaveButtonView disabled label={i18n.t("action.customActionResultStorageLoading")} />
  }

  if (provider === "notebase") {
    return <NotebaseSaveButton {...props} />
  }

  return <DeviceSaveButton {...props} provider={provider} />
}

function NotebaseSaveButton({ action, isRunning, result }: SaveButtonProps) {
  const connection = sanitizeCustomActionNotebaseConnection(
    action.notebaseConnection,
    action.outputSchema,
  )
  const { isPending: isSessionPending } = authClient.useSession()
  const { save, isSaving, isAuthenticated, hasCurrentAccount } = useSaveToNotebase()

  const handleClick = () => {
    if (!result) return
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

  return <SaveButtonView disabled={isDisabled} label={label} onClick={handleClick} />
}

function DeviceSaveButton({
  action,
  isRunning,
  result,
  provider,
}: SaveButtonProps & { provider: Exclude<CustomActionResultStorageProvider, "notebase"> }) {
  const [isSaving, setIsSaving] = useState(false)
  const label =
    provider === "local"
      ? i18n.t(
          isSaving
            ? "action.customActionResultStorageSaving"
            : "action.customActionResultSaveLocal",
        )
      : i18n.t(
          isSaving
            ? "action.customActionResultStorageSaving"
            : "action.customActionResultSaveWebDav",
        )

  const handleClick = async () => {
    if (!result || isSaving) return
    setIsSaving(true)
    try {
      const response = await sendMessage("saveCustomActionResults", {
        actionId: action.id,
        actionName: action.name,
        results: [result],
        sourceUrl: window.location.href,
        sourceTitle: getSourceDocumentTitle() || null,
      })

      if (!response.ok) {
        toastManager.add({
          type: "error",
          title: i18n.t("action.customActionResultStorageSaveFailed"),
          description: getCustomActionResultStorageErrorMessage(response.error),
        })
        return
      }

      toastManager.add({
        type: "success",
        title: i18n.t(
          provider === "local"
            ? "action.customActionResultStorageSavedLocal"
            : "action.customActionResultStorageSavedWebDav",
        ),
        description: action.name,
      })
    } catch {
      toastManager.add({
        type: "error",
        title: i18n.t("action.customActionResultStorageSaveFailed"),
        description: i18n.t("action.customActionResultStorageErrorGeneric"),
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SaveButtonView
      disabled={isRunning || !result || isSaving}
      label={label}
      onClick={handleClick}
    />
  )
}

function SaveButtonView({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean
  label: string
  onClick?: () => void
}) {
  return (
    <Button
      type="button"
      variant="brand"
      size="sm"
      className={cn("min-w-0 shrink", SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.button)}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <IconBookmarkPlus className={SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.icon} />
      <span className={cn("truncate", SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.label)}>
        {label}
      </span>
    </Button>
  )
}
