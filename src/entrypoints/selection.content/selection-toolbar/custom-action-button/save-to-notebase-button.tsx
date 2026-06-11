import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseAccount,
} from "@/types/config/selection-toolbar"
import { useMutation } from "@tanstack/react-query"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { authClient } from "@/utils/auth/auth-client"
import { sendMessage } from "@/utils/message"
import { useNotebaseBetaStatus } from "@/utils/notebase/beta"
import {
  classifyConnectedNotebaseOwnership,
  createNotebaseConnectedAccountSnapshot,
  isConnectedNotebaseInList,
  refreshNotebaseConnectionAccountSnapshot,
  sanitizeCustomActionNotebaseConnection,
} from "@/utils/notebase/connection"
import {
  isORPCForbiddenError,
  isORPCNotFoundError,
  isORPCUnauthorizedError,
  isORPCValidationError,
} from "@/utils/notebase/errors"
import {
  buildNotebaseRowCells,
  validateNotebaseMappings,
} from "@/utils/notebase/mapping"
import {
  createPendingConnectedNotebaseSave,
  createPendingNotebaseSave,
  getNotebaseDetailUrl,
} from "@/utils/notebase/pending-save"
import { orpc, orpcClient } from "@/utils/orpc/client"
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
  const betaExperienceConfig = useAtomValue(configFieldsAtomMap.betaExperience)

  if (!betaExperienceConfig.enabled) {
    return null
  }

  return (
    <SaveToNotebaseButtonEnabled
      action={action}
      isRunning={isRunning}
      result={result}
    />
  )
}

function SaveToNotebaseButtonEnabled({
  action,
  isRunning,
  result,
}: {
  action: SelectionToolbarCustomAction
  isRunning: boolean
  result: Record<string, unknown> | null
}) {
  const connection = sanitizeCustomActionNotebaseConnection(action.notebaseConnection, action.outputSchema)
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const setSaveToNotebaseDialog = useSetAtom(saveToNotebaseDialogAtom)
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const currentAccount = createNotebaseConnectedAccountSnapshot(session?.user)
  const [isPreparingSave, setIsPreparingSave] = useState(false)
  const savingNotebaseNameRef = useRef<string | undefined>(connection?.notebaseNameSnapshot)
  const betaStatusQuery = useNotebaseBetaStatus(isAuthenticated)
  const isBetaAllowed = betaStatusQuery.data?.allowed === true

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

  const saveMutation = useMutation(orpc.notebaseRow.create.mutationOptions({
    meta: {
      suppressToast: true,
    },
    onSuccess: (_data, variables) => {
      const notebaseUrl = getNotebaseDetailUrl(variables.notebaseId)
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
      if (isORPCUnauthorizedError(error)) {
        toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
        return
      }

      if (isORPCForbiddenError(error)) {
        toast.error(i18n.t("action.saveToNotebaseBetaRequired"))
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
  }))

  const openCreateOrConnectDialog = () => {
    if (!result) {
      return
    }

    setSaveToNotebaseDialog({
      open: true,
      mode: "create_or_connect",
      pendingNotebaseSave: createPendingNotebaseSave(action, result),
    })
  }

  const openForeignConnectionDialog = (connectedAccount: SelectionToolbarCustomActionNotebaseAccount) => {
    if (!result) {
      return
    }

    setSaveToNotebaseDialog({
      open: true,
      mode: "foreign_connection",
      pendingNotebaseSave: createPendingNotebaseSave(action, result),
      connectedAccount,
    })
  }

  const isUnconnectedDisabled = isSessionPending
    || isRunning
    || !result
    || (
      isAuthenticated
      && (
        betaStatusQuery.isPending
        || !!betaStatusQuery.error
        || !isBetaAllowed
      )
    )

  if (!connection) {
    return (
      <Button
        type="button"
        variant="brand"
        size="sm"
        disabled={isUnconnectedDisabled}
        onClick={openCreateOrConnectDialog}
      >
        {i18n.t("action.saveToNotebase")}
      </Button>
    )
  }

  const refreshConnectionInConfig = async (nextConnection: NonNullable<typeof connection>) => {
    await setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customActions: selectionToolbarConfig.customActions.map(item =>
        item.id === action.id
          ? { ...item, notebaseConnection: nextConnection }
          : item,
      ),
    })
  }

  const handleSave = async () => {
    if (!connection || !result) {
      return
    }

    if (!isAuthenticated) {
      const pendingNotebaseSave = createPendingConnectedNotebaseSave(action, connection, result)
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
        openCreateOrConnectDialog()
        return
      }

      if (ownership.kind === "foreign_account") {
        openForeignConnectionDialog(connection.connectedAccount)
        return
      }

      const schema = await orpcClient.notebase.getSchema({ id: connection.notebaseId })
      const refreshedConnection = refreshNotebaseConnectionAccountSnapshot(connection, currentAccount, schema.name)
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
      saveMutation.mutate({
        notebaseId: refreshedConnection.notebaseId,
        data: {
          cells,
        },
      })
    }
    catch (error) {
      if (isORPCUnauthorizedError(error)) {
        toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
        return
      }

      if (isORPCForbiddenError(error)) {
        toast.error(i18n.t("action.saveToNotebaseBetaRequired"))
        return
      }

      if (isORPCNotFoundError(error)) {
        openCreateOrConnectDialog()
        return
      }

      if (isORPCValidationError(error)) {
        showConnectionInvalidToast()
        return
      }

      toast.error(i18n.t("action.saveToNotebaseFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    }
    finally {
      setIsPreparingSave(false)
    }
  }

  const isDisabled = isSessionPending
    || isRunning
    || !result
    || (
      isAuthenticated
      && (
        betaStatusQuery.isPending
        || !!betaStatusQuery.error
        || !isBetaAllowed
        || !currentAccount
      )
    )
    || isPreparingSave
    || saveMutation.isPending

  return (
    <Button
      type="button"
      size="sm"
      variant="brand"
      disabled={isDisabled}
      onClick={() => void handleSave()}
    >
      {isPreparingSave || saveMutation.isPending ? i18n.t("action.saveToNotebaseSaving") : i18n.t("action.saveToNotebase")}
    </Button>
  )
}
