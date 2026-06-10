import type { PendingNotebaseSave } from "@/utils/notebase-pending-save"
import { useMutation } from "@tanstack/react-query"
import { useAtom } from "jotai"
import { useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/base-ui/dialog"
import { shadowWrapper } from "@/entrypoints/selection.content"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "@/entrypoints/selection.content/overlay-layers"
import { env } from "@/env"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { authClient } from "@/utils/auth/auth-client"
import { sendMessage } from "@/utils/message"
import {
  isORPCUnauthorizedError,
  isORPCValidationError,
} from "@/utils/notebase"
import { isORPCForbiddenError } from "@/utils/notebase-beta"
import {
  buildNotebaseConnectionFromPending,
  buildNotebaseCreateInputFromPending,
  setPendingNotebaseSave,
} from "@/utils/notebase-pending-save"
import { orpcClient } from "@/utils/orpc/client"
import { saveToNotebaseDialogAtom } from "./save-to-notebase-dialog-atom"

export function SaveToNotebaseDialogHost() {
  const [dialogState, setDialogState] = useAtom(saveToNotebaseDialogAtom)
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const [isPreparingLogin, setIsPreparingLogin] = useState(false)
  const pending = dialogState.open ? dialogState.pending : null

  const closeDialog = () => {
    setDialogState({ open: false })
  }

  const createAndSaveMutation = useMutation({
    meta: {
      suppressToast: true,
    },
    mutationFn: async (pending: PendingNotebaseSave) => {
      await orpcClient.notebase.create(buildNotebaseCreateInputFromPending(pending) as never)
      return pending
    },
    onSuccess: async (pending) => {
      const nextConnection = buildNotebaseConnectionFromPending(pending)
      await setSelectionToolbarConfig({
        ...selectionToolbarConfig,
        customActions: selectionToolbarConfig.customActions.map(item =>
          item.id === pending.actionId
            ? { ...item, notebaseConnection: nextConnection }
            : item,
        ),
      })

      closeDialog()
      toast.success(i18n.t("action.saveToNotebaseSuccess"), {
        description: pending.actionName,
      })
    },
    onError: (error: unknown) => {
      if (isORPCUnauthorizedError(error)) {
        toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
        return
      }

      if (isORPCForbiddenError(error)) {
        toast.error(i18n.t("action.saveToNotebaseBetaRequired"))
        return
      }

      if (isORPCValidationError(error)) {
        toast.error(i18n.t("action.saveToNotebaseConnectionInvalid"))
        return
      }

      toast.error(i18n.t("action.saveToNotebaseFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    },
  })

  const handleCreateAndSave = () => {
    if (!pending) {
      return
    }

    createAndSaveMutation.mutate(pending)
  }

  const handleLoginAndAutoCreate = async () => {
    if (!pending) {
      return
    }

    setIsPreparingLogin(true)
    try {
      await setPendingNotebaseSave(pending)

      const loginUrl = new URL("/log-in", env.WXT_WEBSITE_URL)
      loginUrl.searchParams.set("redirectTo", "/home")

      await sendMessage("openPage", {
        url: loginUrl.toString(),
        active: true,
      })

      closeDialog()
      toast.success(i18n.t("action.saveToNotebasePendingLogin"), {
        description: i18n.t("action.saveToNotebasePendingLoginDescription"),
      })
    }
    catch (error) {
      toast.error(i18n.t("action.saveToNotebaseFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    }
    finally {
      setIsPreparingLogin(false)
    }
  }

  const handleConnectExisting = () => {
    if (!pending) {
      return
    }

    closeDialog()
    void sendMessage("openOptionsPage", {
      route: `/custom-actions?actionId=${encodeURIComponent(pending.actionId)}`,
    })
  }

  const isCreateFlowBusy = createAndSaveMutation.isPending || isPreparingLogin

  return (
    <Dialog
      open={dialogState.open}
      onOpenChange={(open) => {
        if (!open) {
          closeDialog()
        }
      }}
    >
      <DialogContent
        container={shadowWrapper ?? document.body}
        className={`${SELECTION_CONTENT_OVERLAY_LAYERS.popoverOverlay} sm:max-w-lg`}
        forceRenderOverlay
        overlayClassName={SELECTION_CONTENT_OVERLAY_LAYERS.popoverOverlay}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{i18n.t("action.saveToNotebaseCreateTitle")}</DialogTitle>
          <DialogDescription>
            {i18n.t("action.saveToNotebaseCreateDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            disabled={isCreateFlowBusy}
            onClick={() => {
              if (isAuthenticated) {
                handleCreateAndSave()
                return
              }

              void handleLoginAndAutoCreate()
            }}
          >
            {isCreateFlowBusy
              ? i18n.t("action.saveToNotebaseSaving")
              : (
                  isAuthenticated
                    ? i18n.t("action.saveToNotebaseCreateAndSave")
                    : i18n.t("action.saveToNotebaseLoginAndCreate")
                )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isCreateFlowBusy}
            onClick={handleConnectExisting}
          >
            {i18n.t("action.saveToNotebaseConnectExisting")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
