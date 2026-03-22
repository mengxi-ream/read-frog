import type { ColumnConfig } from "@read-frog/definitions"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseConnection,
  SelectionToolbarCustomActionNotebaseMapping,
  SelectionToolbarCustomActionOutputField,
  SelectionToolbarCustomActionOutputType,
} from "@/types/config/selection-toolbar"
import { ORPCError } from "@orpc/client"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { orpc } from "@/utils/orpc/client"

export interface NotebaseListItem {
  id: string
  name: string
}

export interface NotebaseColumnSchema {
  id: string
  tableId: string
  name: string
  config: ColumnConfig
  position: number
  isPrimary: boolean
  width: number | null
  createdAt: Date
  updatedAt: Date
}

export interface NotebaseTableSchema {
  id: string
  name: string
  updatedAt: Date
  columns: NotebaseColumnSchema[]
}

export type ResolvedNotebaseMappingStatus = "valid" | "missing_local" | "missing_remote" | "missing_schema" | "incompatible"

export interface ResolvedNotebaseMapping {
  localField: SelectionToolbarCustomActionOutputField | null
  mapping: SelectionToolbarCustomActionNotebaseMapping
  remoteColumn: NotebaseColumnSchema | null
  status: ResolvedNotebaseMappingStatus
}

interface ExtensionNotebaseClient {
  customTable: {
    getSchema: (input: { id: string }) => Promise<NotebaseTableSchema>
  }
}

const notebaseOrpc = orpc as typeof orpc & ExtensionNotebaseClient

export function createNotebaseMapping(
  localFieldId: string,
  remoteColumnId: string,
  remoteColumnNameSnapshot: string,
): SelectionToolbarCustomActionNotebaseMapping {
  return {
    id: getRandomUUID(),
    localFieldId,
    remoteColumnId,
    remoteColumnNameSnapshot,
  }
}

export function isSupportedNotebaseColumnConfig(config: ColumnConfig) {
  return config.type === "string" || config.type === "number"
}

export function isNotebaseMappingCompatible(localType: SelectionToolbarCustomActionOutputType, remoteConfig: ColumnConfig) {
  if (localType === "string") {
    return remoteConfig.type === "string"
  }

  if (localType === "number") {
    return remoteConfig.type === "number"
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

  const tableId = connection.tableId.trim()
  if (!tableId) {
    return undefined
  }

  const outputFieldIds = new Set(outputSchema.map(field => field.id))
  const mappingIds = new Set<string>()
  const localFieldIds = new Set<string>()
  const remoteColumnIds = new Set<string>()
  const mappings = connection.mappings.filter((mapping) => {
    if (!outputFieldIds.has(mapping.localFieldId)) {
      return false
    }

    if (!mapping.localFieldId.trim() || !mapping.remoteColumnId.trim()) {
      return false
    }

    if (mappingIds.has(mapping.id) || localFieldIds.has(mapping.localFieldId) || remoteColumnIds.has(mapping.remoteColumnId)) {
      return false
    }

    mappingIds.add(mapping.id)
    localFieldIds.add(mapping.localFieldId)
    remoteColumnIds.add(mapping.remoteColumnId)
    return true
  }).map(mapping => ({
    ...mapping,
    remoteColumnNameSnapshot: mapping.remoteColumnNameSnapshot.trim() || mapping.remoteColumnId,
  }))

  return {
    tableId,
    tableNameSnapshot: connection.tableNameSnapshot.trim() || tableId,
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
  schema: NotebaseTableSchema | null | undefined,
): ResolvedNotebaseMapping[] {
  const connection = sanitizeCustomActionNotebaseConnection(action.notebaseConnection, action.outputSchema)
  if (!connection) {
    return []
  }

  const outputFields = new Map(action.outputSchema.map(field => [field.id, field]))
  const remoteColumns = new Map(schema?.columns.map(column => [column.id, column]) ?? [])

  return connection.mappings.map((mapping) => {
    const localField = outputFields.get(mapping.localFieldId) ?? null
    const remoteColumn = remoteColumns.get(mapping.remoteColumnId) ?? null

    if (!localField) {
      return { localField, mapping, remoteColumn, status: "missing_local" }
    }

    if (!schema) {
      return { localField, mapping, remoteColumn, status: "missing_schema" }
    }

    if (!remoteColumn) {
      return { localField, mapping, remoteColumn, status: "missing_remote" }
    }

    if (!isNotebaseMappingCompatible(localField.type, remoteColumn.config)) {
      return { localField, mapping, remoteColumn, status: "incompatible" }
    }

    return { localField, mapping, remoteColumn, status: "valid" }
  })
}

export function buildNotebaseRowCells(
  action: SelectionToolbarCustomAction,
  schema: NotebaseTableSchema,
  result: Record<string, unknown> | null,
) {
  const cells: Record<string, unknown> = {}
  const resolvedMappings = resolveNotebaseMappings(action, schema)

  for (const resolvedMapping of resolvedMappings) {
    if (resolvedMapping.status !== "valid" || !resolvedMapping.localField || !resolvedMapping.remoteColumn) {
      continue
    }

    cells[resolvedMapping.remoteColumn.id] = result?.[resolvedMapping.localField.name] ?? null
  }

  return {
    cells,
    resolvedMappings,
  }
}

export async function listNotebases() {
  return await orpc.customTable.list({})
}

export async function getNotebaseSchema(tableId: string) {
  return await notebaseOrpc.customTable.getSchema({ id: tableId })
}

export async function addNotebaseRow(tableId: string, cells: Record<string, unknown>) {
  return await orpc.row.add({
    tableId,
    data: {
      cells,
    },
  })
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
