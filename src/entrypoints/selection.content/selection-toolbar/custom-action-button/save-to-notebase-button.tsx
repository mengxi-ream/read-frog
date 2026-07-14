import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseAccount,
} from "@/types/config/selection-toolbar"
import type { GuideDictionaryNotebaseTracking } from "@/utils/guide/dictionary-notebase"
import { useMutation } from "@tanstack/react-query"
import { useAtom, useSetAtom } from "jotai"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { authClient } from "@/utils/auth/auth-client"
import {
  canUseGuideDictionaryNotebaseTracking,
  getActiveGuideDictionaryNotebaseTrackingForAction,
} from "@/utils/guide/dictionary-notebase"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import {
  classifyConnectedNotebaseOwnership,
  createNotebaseConnectedAccountSnapshot,
  isConnectedNotebaseInList,
  refreshNotebaseConnectionAccountSnapshot,
  sanitizeCustomActionNotebaseConnection,
} from "@/utils/notebase/connection"
import {
  isORPCForbiddenError,
  isORPCNoteLimitExceededError,
  isORPCNotFoundError,
  isORPCUnauthorizedError,
  isORPCValidationError,
} from "@/utils/notebase/errors"
import { buildNotebaseRowCells, validateNotebaseMappings } from "@/utils/notebase/mapping"
import {
  createPendingConnectedNotebaseSave,
  createPendingNotebaseSave,
  getNotebaseDetailUrl,
} from "@/utils/notebase/pending-save"
import { orpc, orpcClient } from "@/utils/orpc/client"
import { showNotebaseLimitExceededToast } from "./notebase-limit-toast"
import { saveToNotebaseDialogAtom } from "./save-to-notebase-dialog-atom"

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
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
  const setSaveToNotebaseDialog = useSetAtom(saveToNotebaseDialogAtom)
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const currentAccount = createNotebaseConnectedAccountSnapshot(session?.user)
  const [isPreparingSave, setIsPreparingSave] = useState(false)
  const savingNotebaseNameRef = useRef<string | undefined>(connection?.notebaseNameSnapshot)
  const savingGuideTrackingRef = useRef<GuideDictionaryNotebaseTracking | null>(null)

  const openCustomActionOptions = () => {
    void sendMessage("openOptionsPage", {
      route: `/custom-actions?actionId=${encodeURIComponent(action.id)}`,
    })
  }

  const showConnectionInvalidToast = () => {
    toast.error(i18n.t("action.saveToNotebaseConnectionInvalid"), {
      action: {
        label: i18n.t("action.openCustomActions"),
        onClick: openCustomActionOptions,
      },
    })
  }

  const completeGuideDictionaryNotebase = (
    tracking: GuideDictionaryNotebaseTracking,
    notebaseId: string,
  ) => {
    void sendMessage("completeGuideDictionaryNotebase", {
      trackingId: tracking.id,
      actionId: tracking.actionId,
      notebaseId,
      sourceUrl: tracking.sourceUrl,
    }).catch(() => {})
  }

  const saveMutation = useMutation(
    orpc.notebaseRow.create.mutationOptions({
      meta: {
        suppressToast: true,
      },
      onSuccess: (_data, variables) => {
        const notebaseUrl = getNotebaseDetailUrl(variables.notebaseId)
        const guideTracking = savingGuideTrackingRef.current
        savingGuideTrackingRef.current = null
        if (guideTracking) {
          completeGuideDictionaryNotebase(guideTracking, variables.notebaseId)
        }
        toast.success(i18n.t("action.saveToNotebaseSuccess"), {
          description: savingNotebaseNameRef.current ?? connection?.notebaseNameSnapshot,
          action: {
            label: i18n.t("action.openNotebase"),
            onClick: () => {
              void sendMessage("openPage", {
                url: notebaseUrl,
                active: true,
              })
            },
          },
        })
      },
      onError: (error: unknown) => {
        savingGuideTrackingRef.current = null
        if (isORPCUnauthorizedError(error)) {
          toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
          return
        }

        if (isORPCNoteLimitExceededError(error)) {
          showNotebaseLimitExceededToast()
          return
        }

        if (isORPCForbiddenError(error)) {
          toast.error(i18n.t("action.saveToNotebaseAccessDenied"))
          return
        }

        if (isORPCNotFoundError(error)) {
          toast.error(i18n.t("action.saveToNotebaseTableUnavailable"))
          return
        }

        if (isORPCValidationError(error)) {
          showConnectionInvalidToast()
          return
        }

        toast.error(i18n.t("action.saveToNotebaseFailed"), {
          description: error instanceof Error ? error.message : undefined,
        })
      },
    }),
  )

  const getCurrentGuideDictionaryNotebaseUrl = () => {
    const currentUrl = window.location.href
    return canUseGuideDictionaryNotebaseTracking(action.id, currentUrl) ? currentUrl : null
  }

  const openCreateOrConnectDialog = async () => {
    if (!result) {
      return
    }

    const guideDictionaryNotebaseUrl = getCurrentGuideDictionaryNotebaseUrl()
    const guideDictionaryNotebaseTracking = guideDictionaryNotebaseUrl
      ? await getActiveGuideDictionaryNotebaseTrackingForAction(
          action.id,
          guideDictionaryNotebaseUrl,
        )
      : null
    setSaveToNotebaseDialog({
      open: true,
      mode: "create_or_connect",
      pendingNotebaseSave: createPendingNotebaseSave(action, result, Date.now(), {
        guideDictionaryNotebaseTracking: guideDictionaryNotebaseTracking ?? undefined,
      }),
    })
  }

  const openForeignConnectionDialog = async (
    connectedAccount: SelectionToolbarCustomActionNotebaseAccount,
  ) => {
    if (!result) {
      return
    }

    const guideDictionaryNotebaseUrl = getCurrentGuideDictionaryNotebaseUrl()
    const guideDictionaryNotebaseTracking = guideDictionaryNotebaseUrl
      ? await getActiveGuideDictionaryNotebaseTrackingForAction(
          action.id,
          guideDictionaryNotebaseUrl,
        )
      : null
    setSaveToNotebaseDialog({
      open: true,
      mode: "foreign_connection",
      pendingNotebaseSave: createPendingNotebaseSave(action, result, Date.now(), {
        guideDictionaryNotebaseTracking: guideDictionaryNotebaseTracking ?? undefined,
      }),
      connectedAccount,
    })
  }

  const isUnconnectedDisabled = isSessionPending || isRunning || !result

  if (!connection) {
    return (
      <Button
        type="button"
        variant="brand"
        size="sm"
        disabled={isUnconnectedDisabled}
        onClick={() => void openCreateOrConnectDialog()}
      >
        {i18n.t("action.saveToNotebase")}
      </Button>
    )
  }

  const refreshConnectionInConfig = async (nextConnection: NonNullable<typeof connection>) => {
    await setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customActions: selectionToolbarConfig.customActions.map((item) =>
        item.id === action.id ? { ...item, notebaseConnection: nextConnection } : item,
      ),
    })
  }

  const handleSave = async () => {
    if (!connection || !result) {
      return
    }

    if (!isAuthenticated) {
      const guideDictionaryNotebaseUrl = getCurrentGuideDictionaryNotebaseUrl()
      const guideDictionaryNotebaseTracking = guideDictionaryNotebaseUrl
        ? await getActiveGuideDictionaryNotebaseTrackingForAction(
            action.id,
            guideDictionaryNotebaseUrl,
          )
        : null
      const pendingNotebaseSave = createPendingConnectedNotebaseSave(
        action,
        connection,
        result,
        Date.now(),
        {
          guideDictionaryNotebaseTracking: guideDictionaryNotebaseTracking ?? undefined,
        },
      )
      setSaveToNotebaseDialog({
        open: true,
        mode: "connected_login_required",
        pendingNotebaseSave,
        connectedAccount: pendingNotebaseSave.connectionSnapshot.connectedAccount,
      })
      return
    }

    if (!currentAccount) {
      toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
      return
    }

    setIsPreparingSave(true)
    try {
      const notebases = await orpcClient.notebase.list({})
      const ownership = classifyConnectedNotebaseOwnership({
        connection,
        currentAccount,
        isOwned: isConnectedNotebaseInList(connection, notebases),
      })

      if (ownership.kind === "notebase_unavailable") {
        await openCreateOrConnectDialog()
        return
      }

      if (ownership.kind === "foreign_account") {
        await openForeignConnectionDialog(connection.connectedAccount)
        return
      }

      const schema = await orpcClient.notebase.getSchema({ id: connection.notebaseId })
      const refreshedConnection = refreshNotebaseConnectionAccountSnapshot(
        connection,
        currentAccount,
        schema.name,
      )
      await refreshConnectionInConfig(refreshedConnection)

      const actionWithRefreshedConnection = {
        ...action,
        notebaseConnection: refreshedConnection,
      }
      const mappingValidation = validateNotebaseMappings(actionWithRefreshedConnection, schema)
      if (mappingValidation.kind !== "valid") {
        showConnectionInvalidToast()
        return
      }

      const { cells } = buildNotebaseRowCells(actionWithRefreshedConnection, schema, result)
      savingNotebaseNameRef.current = refreshedConnection.notebaseNameSnapshot
      const guideDictionaryNotebaseUrl = getCurrentGuideDictionaryNotebaseUrl()
      savingGuideTrackingRef.current = guideDictionaryNotebaseUrl
        ? await getActiveGuideDictionaryNotebaseTrackingForAction(
            action.id,
            guideDictionaryNotebaseUrl,
          )
        : null
      saveMutation.mutate({
        notebaseId: refreshedConnection.notebaseId,
        data: {
          cells,
        },
      })
    } catch (error) {
      if (isORPCUnauthorizedError(error)) {
        toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
        return
      }

      if (isORPCForbiddenError(error)) {
        toast.error(i18n.t("action.saveToNotebaseAccessDenied"))
        return
      }

      if (isORPCNotFoundError(error)) {
        await openCreateOrConnectDialog()
        return
      }

      if (isORPCValidationError(error)) {
        showConnectionInvalidToast()
        return
      }

      toast.error(i18n.t("action.saveToNotebaseFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsPreparingSave(false)
    }
  }

  const isDisabled =
    isSessionPending ||
    isRunning ||
    !result ||
    (isAuthenticated && !currentAccount) ||
    isPreparingSave ||
    saveMutation.isPending

  return (
    <Button
      type="button"
      size="sm"
      variant="brand"
      disabled={isDisabled}
      onClick={() => void handleSave()}
    >
      {isPreparingSave || saveMutation.isPending
        ? i18n.t("action.saveToNotebaseSaving")
        : i18n.t("action.saveToNotebase")}
    </Button>
  )
}
