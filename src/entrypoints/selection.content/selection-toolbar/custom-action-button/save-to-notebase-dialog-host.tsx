import type { SelectionToolbarCustomActionNotebaseAccount } from "@/types/config/selection-toolbar"
import type { PendingCreateNotebaseSave, PendingNotebaseSave } from "@/utils/notebase/pending-save"
import { useMutation } from "@tanstack/react-query"
import { useAtom } from "jotai"
import { useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/base-ui/avatar"
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
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import {
  createNotebaseConnectedAccountSnapshot,
  formatNotebaseConnectedAccountLabel,
} from "@/utils/notebase/connection"
import {
  isORPCForbiddenError,
  isORPCNoteLimitExceededError,
  isORPCUnauthorizedError,
  isORPCValidationError,
} from "@/utils/notebase/errors"
import {
  buildNotebaseConnectionFromPending,
  buildNotebaseCreateInputFromPending,
  getNotebaseDetailUrl,
  setPendingNotebaseSave,
} from "@/utils/notebase/pending-save"
import { orpcClient } from "@/utils/orpc/client"
import { saveToNotebaseDialogAtom } from "./save-to-notebase-dialog-atom"

function getAccountFallback(account: SelectionToolbarCustomActionNotebaseAccount | undefined) {
  const label = formatNotebaseConnectedAccountLabel(account)
  return Array.from(label ?? "U").slice(0, 2).join("").toUpperCase()
}

function ConnectedAccountDisplay({ account }: { account: SelectionToolbarCustomActionNotebaseAccount | undefined }) {
  const label = formatNotebaseConnectedAccountLabel(account)
  if (!label) {
    return null
  }

  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <Avatar size="sm">
        <AvatarImage src={account?.image ?? ""} alt={label} />
        <AvatarFallback>{getAccountFallback(account)}</AvatarFallback>
      </Avatar>
      <span>{label}</span>
    </span>
  )
}

export function SaveToNotebaseDialogHost() {
  const [dialogState, setDialogState] = useAtom(saveToNotebaseDialogAtom)
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const currentAccount = createNotebaseConnectedAccountSnapshot(session?.user)
  const [isPreparingLogin, setIsPreparingLogin] = useState(false)
  const pendingNotebaseSave = dialogState.open ? dialogState.pendingNotebaseSave : null
  const mode = dialogState.open ? dialogState.mode : null

  const closeDialog = () => {
    setDialogState({ open: false })
  }

  const createAndSaveMutation = useMutation({
    meta: {
      suppressToast: true,
    },
    mutationFn: async ({ pendingNotebaseSave }: {
      pendingNotebaseSave: PendingCreateNotebaseSave
      connectedAccount: SelectionToolbarCustomActionNotebaseAccount
    }) => {
      await orpcClient.notebase.create(buildNotebaseCreateInputFromPending(pendingNotebaseSave))
      return pendingNotebaseSave
    },
    onSuccess: async (pendingNotebaseSave, variables) => {
      const nextConnection = buildNotebaseConnectionFromPending(pendingNotebaseSave, variables.connectedAccount)
      await setSelectionToolbarConfig({
        ...selectionToolbarConfig,
        customActions: selectionToolbarConfig.customActions.map(item =>
          item.id === pendingNotebaseSave.actionId
            ? { ...item, notebaseConnection: nextConnection }
            : item,
        ),
      })

      closeDialog()
      toast.success(i18n.t("action.saveToNotebaseSuccess"), {
        description: pendingNotebaseSave.actionName,
      })

      try {
        await sendMessage("openPage", {
          url: getNotebaseDetailUrl(pendingNotebaseSave.notebaseId),
          active: true,
        })
      }
      catch (error) {
        logger.warn("[SaveToNotebaseDialogHost] Failed to open Notebase detail page", error)
      }
    },
    onError: (error: unknown) => {
      if (isORPCUnauthorizedError(error)) {
        toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
        return
      }

      if (isORPCNoteLimitExceededError(error)) {
        toast.error(i18n.t("action.saveToNotebaseLimitExceeded"))
        return
      }

      if (isORPCForbiddenError(error)) {
        toast.error(i18n.t("action.saveToNotebaseAccessDenied"))
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
    if (!pendingNotebaseSave || pendingNotebaseSave.kind !== "create_notebase") {
      return
    }

    if (!currentAccount) {
      toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
      return
    }

    createAndSaveMutation.mutate({ pendingNotebaseSave, connectedAccount: currentAccount })
  }

  const handleLoginWithPending = async (pendingNotebaseSave: PendingNotebaseSave) => {
    if (!pendingNotebaseSave) {
      return
    }

    setIsPreparingLogin(true)
    try {
      await setPendingNotebaseSave(pendingNotebaseSave)

      const loginUrl = new URL("/log-in", env.WXT_WEBSITE_URL)
      loginUrl.searchParams.set("redirectTo", "/home")

      await sendMessage("openPage", {
        url: loginUrl.toString(),
        active: true,
      })

      closeDialog()
      toast.success(i18n.t("action.saveToNotebasePendingLogin"), {
        description: pendingNotebaseSave.kind === "save_to_connected_notebase"
          ? i18n.t("action.saveToNotebasePendingConnectedLoginDescription")
          : i18n.t("action.saveToNotebasePendingLoginDescription"),
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

  const handleLoginAndAutoCreate = async () => {
    if (!pendingNotebaseSave || pendingNotebaseSave.kind !== "create_notebase") {
      return
    }

    await handleLoginWithPending(pendingNotebaseSave)
  }

  const handleLoginAndContinueConnectedSave = async () => {
    if (!pendingNotebaseSave || pendingNotebaseSave.kind !== "save_to_connected_notebase") {
      return
    }

    await handleLoginWithPending(pendingNotebaseSave)
  }

  const handleConnectExisting = () => {
    if (!pendingNotebaseSave) {
      return
    }

    closeDialog()
    void sendMessage("openOptionsPage", {
      route: `/custom-actions?actionId=${encodeURIComponent(pendingNotebaseSave.actionId)}`,
    })
  }

  const isCreateFlowBusy = createAndSaveMutation.isPending || isPreparingLogin
  const connectedAccount = dialogState.open && "connectedAccount" in dialogState
    ? dialogState.connectedAccount
    : undefined
  const dialogTitle = mode === "connected_login_required"
    ? i18n.t("action.saveToNotebaseLoginConnectedTitle")
    : mode === "foreign_connection"
      ? i18n.t("action.saveToNotebaseConnectionUnavailableTitle")
      : i18n.t("action.saveToNotebaseCreateTitle")
  const primaryButtonLabel = isCreateFlowBusy
    ? i18n.t("action.saveToNotebaseSaving")
    : mode === "connected_login_required"
      ? i18n.t("action.saveToNotebaseLoginAndSave")
      : isAuthenticated
        ? i18n.t("action.saveToNotebaseCreateAndSaveShort")
        : i18n.t("action.saveToNotebaseLoginAndCreate")

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
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {mode === "connected_login_required" && (
              <span className="flex flex-col gap-2">
                <span>{i18n.t("action.saveToNotebaseLoginConnectedDescription")}</span>
                <ConnectedAccountDisplay account={connectedAccount} />
              </span>
            )}
            {mode === "foreign_connection" && (
              <span className="flex flex-col gap-2">
                <span>{i18n.t("action.saveToNotebaseAccountUnavailableDescription")}</span>
                <ConnectedAccountDisplay account={connectedAccount} />
              </span>
            )}
            {mode === "create_or_connect" && i18n.t("action.saveToNotebaseCreateDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="brand"
            disabled={isCreateFlowBusy}
            onClick={() => {
              if (mode === "connected_login_required") {
                void handleLoginAndContinueConnectedSave()
                return
              }

              if (isAuthenticated) {
                handleCreateAndSave()
                return
              }

              void handleLoginAndAutoCreate()
            }}
          >
            {primaryButtonLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isCreateFlowBusy}
            onClick={handleConnectExisting}
          >
            {mode === "connected_login_required"
              ? i18n.t("action.saveToNotebaseGoConfigure")
              : i18n.t("action.saveToNotebaseConnectExisting")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
