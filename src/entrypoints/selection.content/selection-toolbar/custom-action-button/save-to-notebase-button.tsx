import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { authClient } from "@/utils/auth/auth-client"
import {
  buildNotebaseRowCells,
  isORPCNotFoundError,
  isORPCUnauthorizedError,
  isORPCValidationError,
  sanitizeCustomActionNotebaseConnection,
} from "@/utils/notebase"
import { isORPCForbiddenError, useNotebaseBetaStatus } from "@/utils/notebase-beta"
import { orpc } from "@/utils/orpc/client"

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
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const betaStatusQuery = useNotebaseBetaStatus(isAuthenticated)
  const isBetaAllowed = betaStatusQuery.data?.allowed === true

  const schemaQuery = useQuery(orpc.customTable.getSchema.queryOptions({
    input: { id: connection?.tableId ?? "" },
    enabled: isAuthenticated && isBetaAllowed && !!connection?.tableId,
    retry: false,
    meta: {
      suppressToast: true,
    },
  }))

  const saveMutation = useMutation(orpc.row.create.mutationOptions({
    meta: {
      suppressToast: true,
    },
    onSuccess: () => {
      toast.success(i18n.t("action.saveToNotebaseSuccess"), {
        description: connection?.tableNameSnapshot,
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
        toast.error(i18n.t("action.saveToNotebaseConnectionInvalid"))
        return
      }

      toast.error(i18n.t("action.saveToNotebaseFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    },
  }))

  if (!connection) {
    return null
  }

  const resolvedMappings = schemaQuery.data
    ? buildNotebaseRowCells(action, schemaQuery.data, result).resolvedMappings
    : []
  const hasInvalidMappings = resolvedMappings.some(mapping => mapping.status !== "valid")
  const hasValidMappings = resolvedMappings.some(mapping => mapping.status === "valid")

  const handleSave = () => {
    if (!connection || !schemaQuery.data) {
      return
    }

    const { cells, resolvedMappings } = buildNotebaseRowCells(action, schemaQuery.data, result)
    const validMappingCount = resolvedMappings.filter(mapping => mapping.status === "valid").length
    if (validMappingCount === 0) {
      toast.error(i18n.t("action.saveToNotebaseNoMappings"))
      return
    }

    if (resolvedMappings.some(mapping => mapping.status !== "valid")) {
      toast.error(i18n.t("action.saveToNotebaseConnectionInvalid"))
      return
    }

    saveMutation.mutate({
      tableId: connection.tableId,
      data: {
        cells,
      },
    })
  }

  const isDisabled = isSessionPending
    || !isAuthenticated
    || isRunning
    || !result
    || betaStatusQuery.isPending
    || !!betaStatusQuery.error
    || !isBetaAllowed
    || !schemaQuery.data
    || schemaQuery.isPending
    || schemaQuery.isFetching
    || saveMutation.isPending
    || hasInvalidMappings
    || !hasValidMappings
  const disabledTitle = !betaStatusQuery.isPending && !isBetaAllowed
    ? i18n.t("action.saveToNotebaseBetaRequired")
    : undefined

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isDisabled}
      title={disabledTitle}
      onClick={handleSave}
    >
      {saveMutation.isPending ? i18n.t("action.saveToNotebaseSaving") : i18n.t("action.saveToNotebase")}
    </Button>
  )
}
