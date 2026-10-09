import type { AnalyticsFailureReason } from "@/types/analytics"
import type { SelectionToolbarCustomActionNotebaseAccount } from "@/types/config/selection-toolbar"
import type { PendingCreateNotebaseSave, PendingNotebaseSave } from "@/utils/notebase/pending-save"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtom } from "jotai"
import { use, useRef, useState } from "react"
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
import { toastManager } from "@/components/ui/base-ui/toast"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "@/entrypoints/selection.content/overlay-layers"
import { env } from "@/env"
import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { authClient } from "@/utils/auth/auth-client"
import { patchSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { buildCustomActionOptionsRoute } from "@/utils/navigation"
import { trackNoteSaveCompleted } from "@/utils/note-save/analytics"
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
  getPendingNotebaseSaveContext,
  setPendingNotebaseSave,
} from "@/utils/notebase/pending-save"
import { orpc, orpcClient } from "@/utils/orpc/client"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { showNotebaseLimitExceededToast } from "./notebase-limit-toast"
import { saveToNotebaseDialogAtom } from "./save-to-notebase-dialog-atom"

function getAccountFallback(account: SelectionToolbarCustomActionNotebaseAccount | undefined) {
  const label = formatNotebaseConnectedAccountLabel(account)
  return Array.from(label ?? "U")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function ConnectedAccountDisplay({
  account,
}: {
  account: SelectionToolbarCustomActionNotebaseAccount | undefined
}) {
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

async function completeGuideDictionaryNotebaseFromPending(pendingSave: PendingCreateNotebaseSave) {
  const tracking = pendingSave.guideDictionaryNotebaseTracking
  if (!tracking || tracking.actionId !== pendingSave.actionId) {
    return
  }

  try {
    await sendMessage("completeGuideDictionaryNotebase", {
      trackingId: tracking.id,
      actionId: tracking.actionId,
      notebaseId: pendingSave.notebaseId,
      sourceUrl: tracking.sourceUrl,
    })
  } catch (error) {
    logger.warn(
      "[SaveToNotebaseDialogHost] Failed to complete guide Dictionary Notebase flow",
      error,
    )
  }
}

export function SaveToNotebaseDialogHost() {
  const shadowWrapper = use(ShadowWrapperContext)
  const [dialogState, setDialogState] = useAtom(saveToNotebaseDialogAtom)
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const currentAccount = createNotebaseConnectedAccountSnapshot(session?.user)
  const [isPreparingLogin, setIsPreparingLogin] = useState(false)
  const queryClient = useQueryClient()
  const pendingNotebaseSave = dialogState.open ? dialogState.pendingNotebaseSave : null
  const mode = dialogState.open ? dialogState.mode : null

  const closeDialog = () => {
    setDialogState({ open: false })
  }

  // One completion per request. A failed create keeps the dialog open for a
  // retry, so its failure is only final once the user leaves without saving;
  // a login hand-off reports nothing here, since the background reports that
  // save after login.
  const reportedSavesRef = useRef(new WeakSet<PendingNotebaseSave>())
  const lastCreateFailureRef = useRef(new WeakMap<PendingNotebaseSave, AnalyticsFailureReason>())

  const trackCreateAndSaveCompleted = (
    pendingCreateSave: PendingCreateNotebaseSave,
    failureReason?: AnalyticsFailureReason,
  ) => {
    if (reportedSavesRef.current.has(pendingCreateSave)) {
      return
    }
    reportedSavesRef.current.add(pendingCreateSave)

    const context = getPendingNotebaseSaveContext(pendingCreateSave)
    trackNoteSaveCompleted({
      saveSource: context.surface,
      isGuide: context.isGuide,
      noteCount: pendingCreateSave.rows.length,
      path: "create_notebase",
      startedAt: pendingCreateSave.createdAt,
      ...(failureReason ? { failureReason } : {}),
    })
  }

  // The user left the create dialog without saving or logging in. Declining
  // the login that the dialog asks for is the abandoned login itself, so a
  // signed-out dismissal without a failed attempt reports nothing.
  const trackLeftWithoutSaving = () => {
    if (pendingNotebaseSave?.kind !== "create_notebase") {
      return
    }

    const failureReason =
      lastCreateFailureRef.current.get(pendingNotebaseSave) ??
      (isAuthenticated ? "dismissed" : undefined)
    if (failureReason) {
      trackCreateAndSaveCompleted(pendingNotebaseSave, failureReason)
    }
  }

  const createAndSaveMutation = useMutation({
    meta: {
      suppressToast: true,
    },
    mutationFn: async ({
      pendingNotebaseSave: pendingCreateSave,
    }: {
      pendingNotebaseSave: PendingCreateNotebaseSave
      connectedAccount: SelectionToolbarCustomActionNotebaseAccount
    }) => {
      await orpcClient.notebase.create(buildNotebaseCreateInputFromPending(pendingCreateSave), {
        context: { analytics: getPendingNotebaseSaveContext(pendingCreateSave) },
      })
      return pendingCreateSave
    },
    onSuccess: async (createdPendingSave, variables) => {
      // Reported before the config write: the notes are on the server now, and
      // a write that fails below reaches onError, which must not undo that.
      trackCreateAndSaveCompleted(createdPendingSave)
      // The new notebase is now the most recently used one.
      void queryClient.invalidateQueries({
        queryKey: orpc.srs.recentNotebaseScheduleStatusStats.key(),
      })
      const nextConnection = buildNotebaseConnectionFromPending(
        createdPendingSave,
        variables.connectedAccount,
      )
      await setSelectionToolbarConfig(
        patchSelectionToolbarAction(selectionToolbarConfig, createdPendingSave.actionId, {
          notebaseConnection: nextConnection,
        }),
      )

      closeDialog()
      toastManager.add({
        type: "success",
        title: i18n.t("action.saveToNotebaseSuccess"),
        description: createdPendingSave.actionName,
      })
      await completeGuideDictionaryNotebaseFromPending(createdPendingSave)

      try {
        await sendMessage("openPage", {
          url: getNotebaseDetailUrl(createdPendingSave.notebaseId),
          active: true,
        })
      } catch (error) {
        logger.warn("[SaveToNotebaseDialogHost] Failed to open Notebase detail page", error)
      }
    },
    onError: (error: unknown, variables) => {
      lastCreateFailureRef.current.set(variables.pendingNotebaseSave, classifyFailureReason(error))
      if (isORPCUnauthorizedError(error)) {
        toastManager.add({
          type: "error",
          title: i18n.t("action.saveToNotebaseLoginRequired"),
        })
        return
      }

      if (isORPCNoteLimitExceededError(error)) {
        showNotebaseLimitExceededToast()
        return
      }

      if (isORPCForbiddenError(error)) {
        toastManager.add({ type: "error", title: i18n.t("action.saveToNotebaseAccessDenied") })
        return
      }

      if (isORPCValidationError(error)) {
        toastManager.add({
          type: "error",
          title: i18n.t("action.saveToNotebaseConnectionInvalid"),
        })
        return
      }

      toastManager.add({
        type: "error",
        title: i18n.t("action.saveToNotebaseFailed"),
        description: error instanceof Error ? error.message : undefined,
      })
    },
  })

  const handleCreateAndSave = () => {
    if (pendingNotebaseSave?.kind !== "create_notebase") {
      return
    }

    if (!currentAccount) {
      toastManager.add({ type: "error", title: i18n.t("action.saveToNotebaseLoginRequired") })
      return
    }

    createAndSaveMutation.mutate({ pendingNotebaseSave, connectedAccount: currentAccount })
  }

  const handleLoginWithPending = async (pendingSave: PendingNotebaseSave) => {
    if (!pendingSave) {
      return
    }

    setIsPreparingLogin(true)
    try {
      await setPendingNotebaseSave(pendingSave)

      const loginUrl = new URL("/log-in", env.WXT_WEBSITE_URL)
      loginUrl.searchParams.set("redirectTo", "/home")

      await sendMessage("openPage", {
        url: loginUrl.toString(),
        active: true,
      })

      closeDialog()
      toastManager.add({
        type: "success",
        title: i18n.t("action.saveToNotebasePendingLogin"),
        description:
          pendingSave.kind === "save_to_connected_notebase"
            ? i18n.t("action.saveToNotebasePendingConnectedLoginDescription")
            : i18n.t("action.saveToNotebasePendingLoginDescription"),
      })
    } catch (error) {
      toastManager.add({
        type: "error",
        title: i18n.t("action.saveToNotebaseFailed"),
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsPreparingLogin(false)
    }
  }

  const handleLoginAndAutoCreate = async () => {
    if (pendingNotebaseSave?.kind !== "create_notebase") {
      return
    }

    await handleLoginWithPending(pendingNotebaseSave)
  }

  const handleLoginAndContinueConnectedSave = async () => {
    if (pendingNotebaseSave?.kind !== "save_to_connected_notebase") {
      return
    }

    await handleLoginWithPending(pendingNotebaseSave)
  }

  const handleConnectExisting = () => {
    if (!pendingNotebaseSave) {
      return
    }

    trackLeftWithoutSaving()
    closeDialog()
    void sendMessage("openOptionsPage", {
      route: buildCustomActionOptionsRoute(pendingNotebaseSave.actionId, { tab: "notebase" }),
    })
  }

  const isCreateFlowBusy = createAndSaveMutation.isPending || isPreparingLogin
  const connectedAccount =
    dialogState.open && "connectedAccount" in dialogState ? dialogState.connectedAccount : undefined
  const dialogTitle =
    mode === "connected_login_required"
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
          trackLeftWithoutSaving()
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
