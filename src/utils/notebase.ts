import type {
  NotebaseColumn,
  NotebaseGetSchemaOutput,
  NotebaseRowCreateInput,
} from "@read-frog/api-contract"
import type { NotebaseColumnConfig } from "@read-frog/definitions"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseConnection,
  SelectionToolbarCustomActionNotebaseMapping,
  SelectionToolbarCustomActionOutputField,
  SelectionToolbarCustomActionOutputType,
} from "@/types/config/selection-toolbar"
import { ORPCError } from "@orpc/client"
import { getRandomUUID } from "@/utils/crypto-polyfill"

export type ResolvedNotebaseMappingStatus = "valid" | "missing_local" | "missing_remote" | "missing_schema" | "incompatible"

export interface ResolvedNotebaseMapping {
  localField: SelectionToolbarCustomActionOutputField | null
  mapping: SelectionToolbarCustomActionNotebaseMapping
  notebaseColumn: NotebaseColumn | null
  status: ResolvedNotebaseMappingStatus
}

export function createNotebaseMapping(
  localFieldId: string,
  notebaseColumnId: string,
  notebaseColumnNameSnapshot: string,
): SelectionToolbarCustomActionNotebaseMapping {
  return {
    id: getRandomUUID(),
    localFieldId,
    notebaseColumnId,
    notebaseColumnNameSnapshot,
  }
}

export function isSupportedNotebaseColumnConfig(config: NotebaseColumnConfig) {
  return config.type === "string" || config.type === "number"
}

export function isNotebaseMappingCompatible(localType: SelectionToolbarCustomActionOutputType, notebaseColumnConfig: NotebaseColumnConfig) {
  if (localType === "string") {
    return notebaseColumnConfig.type === "string"
  }

  if (localType === "number") {
    return notebaseColumnConfig.type === "number"
  }

  return false
}

export function sanitizeCustomActionNotebaseConnection(
  connection: SelectionToolbarCustomActionNotebaseConnection | undefined,
  outputSchema: SelectionToolbarCustomActionOutputField[],
): SelectionToolbarCustomActionNotebaseConnection | undefined {
  if (!connection) {
    return undefined
  }

  const notebaseId = connection.notebaseId.trim()
  if (!notebaseId) {
    return undefined
  }

  const outputFieldIds = new Set(outputSchema.map(field => field.id))
  const mappingIds = new Set<string>()
  const localFieldIds = new Set<string>()
  const notebaseColumnIds = new Set<string>()
  const mappings = connection.mappings.filter((mapping) => {
    if (!outputFieldIds.has(mapping.localFieldId)) {
      return false
    }

    if (!mapping.localFieldId.trim() || !mapping.notebaseColumnId.trim()) {
      return false
    }

    if (mappingIds.has(mapping.id) || localFieldIds.has(mapping.localFieldId) || notebaseColumnIds.has(mapping.notebaseColumnId)) {
      return false
    }

    mappingIds.add(mapping.id)
    localFieldIds.add(mapping.localFieldId)
    notebaseColumnIds.add(mapping.notebaseColumnId)
    return true
  }).map(mapping => ({
    ...mapping,
    notebaseColumnNameSnapshot: mapping.notebaseColumnNameSnapshot.trim() || mapping.notebaseColumnId,
  }))

  return {
    notebaseId,
    notebaseNameSnapshot: connection.notebaseNameSnapshot.trim() || notebaseId,
    mappings,
  }
}

export function sanitizeSelectionToolbarCustomAction(action: SelectionToolbarCustomAction): SelectionToolbarCustomAction {
  return {
    ...action,
    notebaseConnection: sanitizeCustomActionNotebaseConnection(action.notebaseConnection, action.outputSchema),
  }
}

export function resolveNotebaseMappings(
  action: SelectionToolbarCustomAction,
  schema: NotebaseGetSchemaOutput | null | undefined,
): ResolvedNotebaseMapping[] {
  const connection = sanitizeCustomActionNotebaseConnection(action.notebaseConnection, action.outputSchema)
  if (!connection) {
    return []
  }

  const outputFields = new Map(action.outputSchema.map(field => [field.id, field]))
  const notebaseColumns = new Map(schema?.notebaseColumns.map(column => [column.id, column]) ?? [])

  return connection.mappings.map((mapping) => {
    const localField = outputFields.get(mapping.localFieldId) ?? null
    const notebaseColumn = notebaseColumns.get(mapping.notebaseColumnId) ?? null

    if (!localField) {
      return { localField, mapping, notebaseColumn, status: "missing_local" }
    }

    if (!schema) {
      return { localField, mapping, notebaseColumn, status: "missing_schema" }
    }

    if (!notebaseColumn) {
      return { localField, mapping, notebaseColumn, status: "missing_remote" }
    }

    if (!isNotebaseMappingCompatible(localField.type, notebaseColumn.config)) {
      return { localField, mapping, notebaseColumn, status: "incompatible" }
    }

    return { localField, mapping, notebaseColumn, status: "valid" }
  })
}

export function buildNotebaseRowCells(
  action: SelectionToolbarCustomAction,
  schema: NotebaseGetSchemaOutput,
  result: Record<string, unknown> | null,
) {
  const cells: NotebaseRowCreateInput["data"]["cells"] = {}
  const resolvedMappings = resolveNotebaseMappings(action, schema)

  for (const resolvedMapping of resolvedMappings) {
    if (resolvedMapping.status !== "valid" || !resolvedMapping.localField || !resolvedMapping.notebaseColumn) {
      continue
    }

    cells[resolvedMapping.notebaseColumn.id] = result?.[resolvedMapping.localField.name] ?? null
  }

  return {
    cells,
    resolvedMappings,
  }
}

export function isORPCUnauthorizedError(error: unknown) {
  return error instanceof ORPCError && (error.code === "UNAUTHORIZED" || error.status === 401)
}

export function isORPCNotFoundError(error: unknown) {
  return error instanceof ORPCError && (error.code === "NOT_FOUND" || error.status === 404)
}

export function isORPCValidationError(error: unknown) {
  return error instanceof ORPCError && (error.code === "CELL_VALIDATION_FAILED" || error.status === 422)
}
