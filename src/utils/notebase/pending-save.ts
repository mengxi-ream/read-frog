import type { NotebaseCreateInput, NotebaseGetSchemaOutput } from "@read-frog/api-contract"
import type { z } from "zod"
import type { Config } from "@/types/config/config"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseAccount,
  SelectionToolbarCustomActionNotebaseConnection,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import { z as zod } from "zod"
import { storage } from "#imports"
import { env } from "@/env"
import { selectionToolbarCustomActionNotebaseConnectionSchema } from "@/types/config/selection-toolbar"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { buildNotebaseRowCells } from "./mapping"

export const NOTEBASE_PENDING_SAVE_STORAGE_KEY = "notebasePendingSave"
export const NOTEBASE_PENDING_SAVE_TTL_MS = 10 * 60 * 1000

const pendingNotebaseSaveColumnSchema = zod.object({
  localFieldId: zod.string().nonempty(),
  localFieldName: zod.string().min(1),
  localFieldType: zod.enum(["string", "number"]),
  notebaseColumnId: zod.uuid(),
  notebaseColumnName: zod.string().min(1),
})

const pendingNotebaseSaveBaseSchema = zod.object({
  id: zod.uuid(),
  createdAt: zod.number(),
  expiresAt: zod.number(),
  actionId: zod.string().nonempty(),
  actionName: zod.string().min(1),
  outputSchemaFingerprint: zod.string(),
})

export const pendingCreateNotebaseSaveSchema = pendingNotebaseSaveBaseSchema.extend({
  kind: zod.literal("create_notebase"),
  notebaseId: zod.uuid(),
  rowId: zod.uuid(),
  columns: zod.array(pendingNotebaseSaveColumnSchema).min(1),
  cells: zod.record(zod.string(), zod.unknown()),
})

export const pendingConnectedNotebaseSaveSchema = pendingNotebaseSaveBaseSchema.extend({
  kind: zod.literal("save_to_connected_notebase"),
  connectionSnapshot: selectionToolbarCustomActionNotebaseConnectionSchema,
  result: zod.record(zod.string(), zod.unknown()),
})

export const pendingNotebaseSaveSchema = zod.union([
  pendingCreateNotebaseSaveSchema,
  pendingConnectedNotebaseSaveSchema,
])

export type PendingNotebaseSave = z.infer<typeof pendingNotebaseSaveSchema>
export type PendingCreateNotebaseSave = z.infer<typeof pendingCreateNotebaseSaveSchema>
export type PendingConnectedNotebaseSave = z.infer<typeof pendingConnectedNotebaseSaveSchema>

export type PendingNotebaseSaveActionStatus
  = | "valid"
    | "missing_action"
    | "already_connected"
    | "missing_connection"
    | "connection_changed"
    | "schema_changed"

interface PendingNotebaseSaveActionValidation {
  status: PendingNotebaseSaveActionStatus
  action?: SelectionToolbarCustomAction
  actionIndex?: number
}

export function getOutputSchemaFingerprint(outputSchema: SelectionToolbarCustomActionOutputField[]) {
  return JSON.stringify(outputSchema.map(field => ({
    id: field.id,
    name: field.name,
    type: field.type,
  })))
}

export function createPendingNotebaseSave(
  action: SelectionToolbarCustomAction,
  result: Record<string, unknown>,
  now = Date.now(),
): PendingCreateNotebaseSave {
  const columns = action.outputSchema.map(field => ({
    localFieldId: field.id,
    localFieldName: field.name,
    localFieldType: field.type,
    notebaseColumnId: getRandomUUID(),
    notebaseColumnName: field.name,
  }))

  return {
    kind: "create_notebase",
    id: getRandomUUID(),
    createdAt: now,
    expiresAt: now + NOTEBASE_PENDING_SAVE_TTL_MS,
    actionId: action.id,
    actionName: action.name.trim() || action.name,
    outputSchemaFingerprint: getOutputSchemaFingerprint(action.outputSchema),
    notebaseId: getRandomUUID(),
    rowId: getRandomUUID(),
    columns,
    cells: Object.fromEntries(
      columns.map(column => [
        column.notebaseColumnId,
        result[column.localFieldName] ?? null,
      ]),
    ),
  }
}

export function createPendingConnectedNotebaseSave(
  action: SelectionToolbarCustomAction,
  connection: SelectionToolbarCustomActionNotebaseConnection,
  result: Record<string, unknown>,
  now = Date.now(),
): PendingConnectedNotebaseSave {
  return {
    kind: "save_to_connected_notebase",
    id: getRandomUUID(),
    createdAt: now,
    expiresAt: now + NOTEBASE_PENDING_SAVE_TTL_MS,
    actionId: action.id,
    actionName: action.name.trim() || action.name,
    outputSchemaFingerprint: getOutputSchemaFingerprint(action.outputSchema),
    connectionSnapshot: connection,
    result,
  }
}

export function buildNotebaseCreateInputFromPending(pending: PendingCreateNotebaseSave): NotebaseCreateInput {
  return {
    id: pending.notebaseId,
    name: pending.actionName,
    options: {
      initialColumns: pending.columns.map(column => ({
        id: column.notebaseColumnId,
        name: column.notebaseColumnName,
        config: column.localFieldType === "number"
          ? { type: "number", decimal: 0, format: "number" }
          : { type: "string" },
      })),
      initialRow: {
        id: pending.rowId,
        cells: pending.cells,
      },
    },
  }
}

export function getNotebaseDetailUrl(notebaseId: string) {
  return new URL(`/notebase/${encodeURIComponent(notebaseId)}`, env.WXT_WEBSITE_URL).toString()
}

export function buildNotebaseConnectionFromPending(
  pending: PendingCreateNotebaseSave,
  connectedAccount: SelectionToolbarCustomActionNotebaseAccount,
): SelectionToolbarCustomActionNotebaseConnection {
  return {
    notebaseId: pending.notebaseId,
    notebaseNameSnapshot: pending.actionName,
    connectedAccount,
    mappings: pending.columns.map(column => ({
      id: getRandomUUID(),
      localFieldId: column.localFieldId,
      notebaseColumnId: column.notebaseColumnId,
      notebaseColumnNameSnapshot: column.notebaseColumnName,
    })),
  }
}

export function isPendingNotebaseSaveExpired(pending: PendingNotebaseSave, now = Date.now()) {
  return pending.expiresAt <= now
}

export async function getPendingNotebaseSave() {
  const value = await storage.getItem<unknown>(`local:${NOTEBASE_PENDING_SAVE_STORAGE_KEY}`)
  const parsed = pendingNotebaseSaveSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export async function setPendingNotebaseSave(pending: PendingNotebaseSave) {
  await storage.setItem(`local:${NOTEBASE_PENDING_SAVE_STORAGE_KEY}`, pending)
}

export async function clearPendingNotebaseSave() {
  await storage.removeItem(`local:${NOTEBASE_PENDING_SAVE_STORAGE_KEY}`)
}

function findPendingSaveAction(config: Config, actionId: string) {
  const actionIndex = config.selectionToolbar.customActions.findIndex(action => action.id === actionId)
  if (actionIndex < 0) {
    return null
  }

  const action = config.selectionToolbar.customActions[actionIndex]
  if (!action) {
    return null
  }

  return { action, actionIndex }
}

function doesPendingActionSchemaMatch(
  action: SelectionToolbarCustomAction,
  pending: Pick<PendingNotebaseSave, "outputSchemaFingerprint">,
) {
  return getOutputSchemaFingerprint(action.outputSchema) === pending.outputSchemaFingerprint
}

export function validateStillCanSavePendingCreateNotebaseSave(
  config: Config,
  pending: PendingCreateNotebaseSave,
): PendingNotebaseSaveActionValidation {
  const pendingAction = findPendingSaveAction(config, pending.actionId)
  if (!pendingAction) {
    return { status: "missing_action" }
  }

  const { action, actionIndex } = pendingAction
  if (action.notebaseConnection) {
    return { status: "already_connected", action, actionIndex }
  }

  if (!doesPendingActionSchemaMatch(action, pending)) {
    return { status: "schema_changed", action, actionIndex }
  }

  return { status: "valid", action, actionIndex }
}

export function validateStillCanSavePendingConnectedNotebaseSave(
  config: Config,
  pending: PendingConnectedNotebaseSave,
): PendingNotebaseSaveActionValidation {
  const pendingAction = findPendingSaveAction(config, pending.actionId)
  if (!pendingAction) {
    return { status: "missing_action" }
  }

  const { action, actionIndex } = pendingAction
  if (!doesPendingActionSchemaMatch(action, pending)) {
    return { status: "schema_changed", action, actionIndex }
  }

  if (!action.notebaseConnection) {
    return { status: "missing_connection", action, actionIndex }
  }

  if (!doesConnectionMatchPendingSnapshot(action.notebaseConnection, pending.connectionSnapshot)) {
    return { status: "connection_changed", action, actionIndex }
  }

  return { status: "valid", action, actionIndex }
}

function doesConnectionMatchPendingSnapshot(
  connection: SelectionToolbarCustomActionNotebaseConnection,
  snapshot: SelectionToolbarCustomActionNotebaseConnection,
) {
  if (connection.notebaseId !== snapshot.notebaseId) {
    return false
  }

  if (connection.mappings.length !== snapshot.mappings.length) {
    return false
  }

  return connection.mappings.every((mapping, index) => {
    const snapshotMapping = snapshot.mappings[index]
    return !!snapshotMapping
      && mapping.localFieldId === snapshotMapping.localFieldId
      && mapping.notebaseColumnId === snapshotMapping.notebaseColumnId
  })
}

export function applyCreatedNotebaseConnectionToConfig(
  config: Config,
  pending: PendingCreateNotebaseSave,
  options: {
    connectedAccount: SelectionToolbarCustomActionNotebaseAccount
    replaceExistingConnection?: boolean
  },
): {
  status: PendingNotebaseSaveActionStatus
  config?: Config
} {
  const pendingAction = findPendingSaveAction(config, pending.actionId)
  if (!pendingAction) {
    return { status: "missing_action" }
  }

  const { action, actionIndex } = pendingAction
  if (!options.replaceExistingConnection && action.notebaseConnection) {
    return { status: "already_connected" }
  }

  if (!doesPendingActionSchemaMatch(action, pending)) {
    return { status: "schema_changed" }
  }

  return {
    status: "valid",
    config: {
      ...config,
      selectionToolbar: {
        ...config.selectionToolbar,
        customActions: config.selectionToolbar.customActions.map((action, index) =>
          index === actionIndex
            ? {
                ...action,
                notebaseConnection: buildNotebaseConnectionFromPending(pending, options.connectedAccount),
              }
            : action,
        ),
      },
    },
  }
}

export function buildConnectedPendingRow(
  action: SelectionToolbarCustomAction,
  pending: PendingConnectedNotebaseSave,
  schema: NotebaseGetSchemaOutput,
) {
  return buildNotebaseRowCells({
    ...action,
    notebaseConnection: pending.connectionSnapshot,
  }, schema, pending.result)
}

export function doesSchemaMatchPendingColumns(
  schema: NotebaseGetSchemaOutput,
  pending: PendingCreateNotebaseSave,
) {
  if (schema.notebaseColumns.length !== pending.columns.length) {
    return false
  }

  return pending.columns.every((pendingColumn, index) => {
    const column = schema.notebaseColumns[index]
    if (!column) {
      return false
    }

    if (
      column.id !== pendingColumn.notebaseColumnId
      || column.name !== pendingColumn.notebaseColumnName
      || column.position !== index
      || column.isPrimary !== (index === 0)
    ) {
      return false
    }

    if (pendingColumn.localFieldType === "string") {
      return column.config.type === "string"
    }

    return column.config.type === "number"
      && column.config.decimal === 0
      && column.config.format === "number"
  })
}
