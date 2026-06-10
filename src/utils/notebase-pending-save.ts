import type { NotebaseCreateInput, NotebaseGetSchemaOutput } from "@read-frog/api-contract"
import type { z } from "zod"
import type { Config } from "@/types/config/config"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseConnection,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import { z as zod } from "zod"
import { storage } from "#imports"
import { getRandomUUID } from "@/utils/crypto-polyfill"

export const NOTEBASE_PENDING_SAVE_STORAGE_KEY = "notebasePendingSave"
export const NOTEBASE_PENDING_SAVE_TTL_MS = 10 * 60 * 1000

const pendingNotebaseSaveColumnSchema = zod.object({
  localFieldId: zod.string().nonempty(),
  localFieldName: zod.string().min(1),
  localFieldType: zod.enum(["string", "number"]),
  notebaseColumnId: zod.uuid(),
  notebaseColumnName: zod.string().min(1),
})

export const pendingNotebaseSaveSchema = zod.object({
  id: zod.uuid(),
  createdAt: zod.number(),
  expiresAt: zod.number(),
  actionId: zod.string().nonempty(),
  actionName: zod.string().min(1),
  outputSchemaFingerprint: zod.string(),
  notebaseId: zod.uuid(),
  rowId: zod.uuid(),
  columns: zod.array(pendingNotebaseSaveColumnSchema).min(1),
  cells: zod.record(zod.string(), zod.unknown()),
})

export type PendingNotebaseSave = z.infer<typeof pendingNotebaseSaveSchema>

export type PendingNotebaseSaveActionStatus
  = | "valid"
    | "missing_action"
    | "already_connected"
    | "schema_changed"

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
): PendingNotebaseSave {
  const columns = action.outputSchema.map(field => ({
    localFieldId: field.id,
    localFieldName: field.name,
    localFieldType: field.type,
    notebaseColumnId: getRandomUUID(),
    notebaseColumnName: field.name,
  }))

  return {
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

export function buildNotebaseCreateInputFromPending(pending: PendingNotebaseSave): NotebaseCreateInput {
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

export function buildNotebaseConnectionFromPending(
  pending: PendingNotebaseSave,
): SelectionToolbarCustomActionNotebaseConnection {
  return {
    notebaseId: pending.notebaseId,
    notebaseNameSnapshot: pending.actionName,
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

export function validatePendingNotebaseSaveAction(
  config: Config,
  pending: PendingNotebaseSave,
): {
  status: PendingNotebaseSaveActionStatus
  action?: SelectionToolbarCustomAction
  actionIndex?: number
} {
  const actionIndex = config.selectionToolbar.customActions.findIndex(action => action.id === pending.actionId)
  if (actionIndex < 0) {
    return { status: "missing_action" }
  }

  const action = config.selectionToolbar.customActions[actionIndex]
  if (!action) {
    return { status: "missing_action" }
  }

  if (action.notebaseConnection) {
    return { status: "already_connected", action, actionIndex }
  }

  if (getOutputSchemaFingerprint(action.outputSchema) !== pending.outputSchemaFingerprint) {
    return { status: "schema_changed", action, actionIndex }
  }

  return { status: "valid", action, actionIndex }
}

export function applyPendingNotebaseConnectionToConfig(config: Config, pending: PendingNotebaseSave): {
  status: PendingNotebaseSaveActionStatus
  config?: Config
} {
  const validation = validatePendingNotebaseSaveAction(config, pending)
  if (validation.status !== "valid" || typeof validation.actionIndex !== "number") {
    return { status: validation.status }
  }

  return {
    status: "valid",
    config: {
      ...config,
      selectionToolbar: {
        ...config.selectionToolbar,
        customActions: config.selectionToolbar.customActions.map((action, index) =>
          index === validation.actionIndex
            ? {
                ...action,
                notebaseConnection: buildNotebaseConnectionFromPending(pending),
              }
            : action,
        ),
      },
    },
  }
}

export function doesSchemaMatchPendingColumns(
  schema: NotebaseGetSchemaOutput,
  pending: PendingNotebaseSave,
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
