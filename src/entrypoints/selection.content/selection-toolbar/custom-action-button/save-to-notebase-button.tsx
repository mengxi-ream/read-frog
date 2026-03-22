import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { authClient } from "@/utils/auth/auth-client"
import {
  addNotebaseRow,
  buildNotebaseRowCells,
  getNotebaseSchema,
  isORPCNotFoundError,
  isORPCUnauthorizedError,
  isORPCValidationError,
  sanitizeCustomActionNotebaseConnection,
} from "@/utils/notebase"

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

  const schemaQuery = useQuery({
    queryKey: ["notebase", "schema", "selection-toolbar", session?.user.id ?? "guest", connection?.tableId ?? "none"],
    queryFn: () => getNotebaseSchema(connection!.tableId),
    enabled: isAuthenticated && !!connection?.tableId,
    retry: false,
    meta: {
      suppressToast: true,
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!connection || !schemaQuery.data) {
        throw new Error("Notebase connection is unavailable")
      }

      const { cells, resolvedMappings } = buildNotebaseRowCells(action, schemaQuery.data, result)
      const validMappingCount = resolvedMappings.filter(mapping => mapping.status === "valid").length
      if (validMappingCount === 0) {
        throw new Error(i18n.t("action.saveToNotebaseNoMappings"))
      }

      if (resolvedMappings.some(mapping => mapping.status !== "valid")) {
        throw new Error(i18n.t("action.saveToNotebaseConnectionInvalid"))
      }

      return await addNotebaseRow(connection.tableId, cells)
    },
    meta: {
      suppressToast: true,
    },
    onSuccess: () => {
      toast.success(i18n.t("action.saveToNotebaseSuccess"), {
        description: connection?.tableNameSnapshot,
      })
    },
    onError: (error) => {
      if (isORPCUnauthorizedError(error)) {
        toast.error(i18n.t("action.saveToNotebaseLoginRequired"))
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
  })

  if (!connection) {
    return null
  }

  const resolvedMappings = schemaQuery.data
    ? buildNotebaseRowCells(action, schemaQuery.data, result).resolvedMappings
    : []
  const hasInvalidMappings = resolvedMappings.some(mapping => mapping.status !== "valid")
  const hasValidMappings = resolvedMappings.some(mapping => mapping.status === "valid")
  const isDisabled = isSessionPending
    || !isAuthenticated
    || isRunning
    || !result
    || !schemaQuery.data
    || schemaQuery.isPending
    || schemaQuery.isFetching
    || saveMutation.isPending
    || hasInvalidMappings
    || !hasValidMappings

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isDisabled}
      onClick={() => saveMutation.mutate()}
    >
      {saveMutation.isPending ? i18n.t("action.saveToNotebaseSaving") : i18n.t("action.saveToNotebase")}
    </Button>
  )
}
