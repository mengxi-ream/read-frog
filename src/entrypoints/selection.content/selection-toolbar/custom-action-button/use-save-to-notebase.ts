import type { SaveToNotebaseAnalyticsSource } from "./save-to-notebase-dialog-atom"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseAccount,
} from "@/types/config/selection-toolbar"
import type { GuideDictionaryNotebaseTracking } from "@/utils/guide/dictionary-notebase"
import { useMutation } from "@tanstack/react-query"
import { useAtom, useSetAtom } from "jotai"
import { useRef, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
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

export type SaveToNotebaseOutcome = "saved" | "dialog_opened" | "failed"

export interface SaveToNotebaseRequest {
  action: SelectionToolbarCustomAction
  /** One record per note, keyed by output-field name. */
  results: Array<Record<string, unknown>>
  /**
   * When set, the action does not exist in config yet: the save flow skips the
   * connected path and opens the create dialog carrying this draft, which is
   * appended to config only when the dialog is confirmed.
   */
  actionDraft?: SelectionToolbarCustomAction
  analyticsSource?: SaveToNotebaseAnalyticsSource
}

/**
 * Shared save-to-notebase orchestration used by the custom action popover and
 * the save suggestion card. Behavior mirrors the original single-result flow;
 * multi-result requests batch rows through `notebaseRow.createMany`.
 */
export function useSaveToNotebase() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
  const setSaveToNotebaseDialog = useSetAtom(saveToNotebaseDialogAtom)
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const currentAccount = createNotebaseConnectedAccountSnapshot(session?.user)
  const [isPreparingSave, setIsPreparingSave] = useState(false)
  const savingNotebaseNameRef = useRef<string | undefined>(undefined)
  const savingGuideTrackingRef = useRef<GuideDictionaryNotebaseTracking | null>(null)

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

  const handleSaveSuccess = (notebaseId: string) => {
    const notebaseUrl = getNotebaseDetailUrl(notebaseId)
    const guideTracking = savingGuideTrackingRef.current
    savingGuideTrackingRef.current = null
    if (guideTracking) {
      completeGuideDictionaryNotebase(guideTracking, notebaseId)
    }
    const toastId = toastManager.add({
      type: "success",
      title: i18n.t("action.saveToNotebaseSuccess"),
      description: savingNotebaseNameRef.current,
      actionProps: {
        children: i18n.t("action.openNotebase"),
        onClick: () => {
          toastManager.close(toastId)
          void sendMessage("openPage", {
            url: notebaseUrl,
            active: true,
          })
        },
      },
    })
  }

  const buildConnectionInvalidToast = (actionId: string) => {
    const toastId = toastManager.add({
      type: "error",
      title: i18n.t("action.saveToNotebaseConnectionInvalid"),
      actionProps: {
        children: i18n.t("action.openCustomActions"),
        onClick: () => {
          toastManager.close(toastId)
          void sendMessage("openOptionsPage", {
            route: `/custom-actions?actionId=${encodeURIComponent(actionId)}`,
          })
        },
      },
    })
  }

  const handleSaveError = (error: unknown) => {
    savingGuideTrackingRef.current = null
    if (isORPCUnauthorizedError(error)) {
      toastManager.add({ type: "error", title: i18n.t("action.saveToNotebaseLoginRequired") })
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

    if (isORPCNotFoundError(error)) {
      toastManager.add({
        type: "error",
        title: i18n.t("action.saveToNotebaseTableUnavailable"),
      })
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
  }

  const saveMutation = useMutation(
    orpc.notebaseRow.create.mutationOptions({
      meta: {
        suppressToast: true,
      },
      onSuccess: (_data, variables) => {
        handleSaveSuccess(variables.notebaseId)
      },
      onError: handleSaveError,
    }),
  )

  const saveManyMutation = useMutation(
    orpc.notebaseRow.createMany.mutationOptions({
      meta: {
        suppressToast: true,
      },
      onSuccess: (_data, variables) => {
        handleSaveSuccess(variables.notebaseId)
      },
      onError: handleSaveError,
    }),
  )

  // Returns null synchronously when guide tracking does not apply, so dialog
  // opens on the common path stay synchronous within the click event.
  const getGuideDictionaryNotebaseTracking = (actionId: string) => {
    const currentUrl = window.location.href
    if (!canUseGuideDictionaryNotebaseTracking(actionId, currentUrl)) {
      return null
    }

    return getActiveGuideDictionaryNotebaseTrackingForAction(actionId, currentUrl)
  }

  const save = async (request: SaveToNotebaseRequest): Promise<SaveToNotebaseOutcome> => {
    const { action, results, actionDraft, analyticsSource } = request
    if (results.length === 0) {
      return "failed"
    }

    const openCreateOrConnectDialog = async () => {
      const trackingLookup = getGuideDictionaryNotebaseTracking(action.id)
      const guideDictionaryNotebaseTracking = trackingLookup ? await trackingLookup : null
      setSaveToNotebaseDialog({
        open: true,
        mode: "create_or_connect",
        pendingNotebaseSave: createPendingNotebaseSave(action, results, Date.now(), {
          guideDictionaryNotebaseTracking: guideDictionaryNotebaseTracking ?? undefined,
        }),
        ...(actionDraft ? { pendingActionDraft: actionDraft } : {}),
        ...(analyticsSource ? { analyticsSource } : {}),
      })
      return "dialog_opened" as const
    }

    const openForeignConnectionDialog = async (
      connectedAccount: SelectionToolbarCustomActionNotebaseAccount,
    ) => {
      const trackingLookup = getGuideDictionaryNotebaseTracking(action.id)
      const guideDictionaryNotebaseTracking = trackingLookup ? await trackingLookup : null
      setSaveToNotebaseDialog({
        open: true,
        mode: "foreign_connection",
        pendingNotebaseSave: createPendingNotebaseSave(action, results, Date.now(), {
          guideDictionaryNotebaseTracking: guideDictionaryNotebaseTracking ?? undefined,
        }),
        connectedAccount,
        ...(analyticsSource ? { analyticsSource } : {}),
      })
      return "dialog_opened" as const
    }

    const connection = actionDraft
      ? null
      : sanitizeCustomActionNotebaseConnection(action.notebaseConnection, action.outputSchema)

    if (!connection) {
      return openCreateOrConnectDialog()
    }

    if (!isAuthenticated) {
      const trackingLookup = getGuideDictionaryNotebaseTracking(action.id)
      const guideDictionaryNotebaseTracking = trackingLookup ? await trackingLookup : null
      const pendingNotebaseSave = createPendingConnectedNotebaseSave(
        action,
        connection,
        results,
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
        ...(analyticsSource ? { analyticsSource } : {}),
      })
      return "dialog_opened"
    }

    if (!currentAccount) {
      toastManager.add({ type: "error", title: i18n.t("action.saveToNotebaseLoginRequired") })
      return "failed"
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
        return await openCreateOrConnectDialog()
      }

      if (ownership.kind === "foreign_account") {
        return await openForeignConnectionDialog(connection.connectedAccount)
      }

      const schema = await orpcClient.notebase.getSchema({ id: connection.notebaseId })
      const refreshedConnection = refreshNotebaseConnectionAccountSnapshot(
        connection,
        currentAccount,
        schema.name,
      )
      await setSelectionToolbarConfig({
        ...selectionToolbarConfig,
        customActions: selectionToolbarConfig.customActions.map((item) =>
          item.id === action.id ? { ...item, notebaseConnection: refreshedConnection } : item,
        ),
      })

      const actionWithRefreshedConnection = {
        ...action,
        notebaseConnection: refreshedConnection,
      }
      const mappingValidation = validateNotebaseMappings(actionWithRefreshedConnection, schema)
      if (mappingValidation.kind !== "valid") {
        buildConnectionInvalidToast(action.id)
        return "failed"
      }

      const cellsList = results.map(
        (result) => buildNotebaseRowCells(actionWithRefreshedConnection, schema, result).cells,
      )
      savingNotebaseNameRef.current = refreshedConnection.notebaseNameSnapshot
      const trackingLookup = getGuideDictionaryNotebaseTracking(action.id)
      savingGuideTrackingRef.current = trackingLookup ? await trackingLookup : null

      // Row-save failures are toasted by the mutation onError handlers; the
      // outer catch below only handles pre-save failures (list/getSchema).
      try {
        const [firstCells] = cellsList
        if (cellsList.length === 1 && firstCells) {
          await saveMutation.mutateAsync({
            notebaseId: refreshedConnection.notebaseId,
            data: {
              cells: firstCells,
            },
          })
        } else {
          await saveManyMutation.mutateAsync({
            notebaseId: refreshedConnection.notebaseId,
            rows: cellsList.map((cells) => ({ cells })),
          })
        }
      } catch {
        return "failed"
      }

      return "saved"
    } catch (error) {
      if (isORPCNotFoundError(error)) {
        return await openCreateOrConnectDialog()
      }

      if (isORPCUnauthorizedError(error)) {
        toastManager.add({
          type: "error",
          title: i18n.t("action.saveToNotebaseLoginRequired"),
        })
        return "failed"
      }

      if (isORPCForbiddenError(error)) {
        toastManager.add({ type: "error", title: i18n.t("action.saveToNotebaseAccessDenied") })
        return "failed"
      }

      if (isORPCValidationError(error)) {
        buildConnectionInvalidToast(action.id)
        return "failed"
      }

      toastManager.add({
        type: "error",
        title: i18n.t("action.saveToNotebaseFailed"),
        description: error instanceof Error ? error.message : undefined,
      })
      return "failed"
    } finally {
      setIsPreparingSave(false)
    }
  }

  return {
    save,
    isSaving: isPreparingSave || saveMutation.isPending || saveManyMutation.isPending,
    isAuthenticated,
    hasCurrentAccount: !!currentAccount,
  }
}
