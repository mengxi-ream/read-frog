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
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { sanitizeCustomActionNotebaseConnection } from "./connection"

export type ResolvedNotebaseMappingStatus =
  | "valid"
  | "missing_local"
  | "missing_remote"
  | "missing_schema"
  | "incompatible"

export interface ResolvedNotebaseMapping {
  localField: SelectionToolbarCustomActionOutputField | null
  mapping: SelectionToolbarCustomActionNotebaseMapping
  notebaseColumn: NotebaseColumn | null
  status: ResolvedNotebaseMappingStatus
}

export type NotebaseMappingValidation =
  | {
      kind: "valid"
      resolvedMappings: ResolvedNotebaseMapping[]
    }
  | {
      kind: "invalid"
      reason: Exclude<ResolvedNotebaseMappingStatus, "valid">
      resolvedMappings: ResolvedNotebaseMapping[]
    }
  | {
      kind: "empty"
      resolvedMappings: ResolvedNotebaseMapping[]
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

export function isNotebaseMappingCompatible(
  localType: SelectionToolbarCustomActionOutputType,
  notebaseColumnConfig: NotebaseColumnConfig,
) {
  return (
    isSupportedNotebaseColumnConfig(notebaseColumnConfig) && localType === notebaseColumnConfig.type
  )
}

function normalizeMappingName(name: string) {
  return name.normalize("NFKC").trim().toLowerCase()
}

/**
 * Maps each field to the free column with the same name (ignoring case and
 * surrounding spaces) that can hold its type. A name is all an action and a
 * Notebase share: one created from the action took its column names from the
 * fields, so it maps whole, while fields of a hand-made Notebase that match no
 * column stay unmapped for the reader to pick instead of being guessed.
 */
export function createNameMatchedNotebaseMappings(
  outputSchema: readonly SelectionToolbarCustomActionOutputField[],
  notebaseColumns: readonly NotebaseColumn[],
): SelectionToolbarCustomActionNotebaseMapping[] {
  const usedColumnIds = new Set<string>()
  const mappings: SelectionToolbarCustomActionNotebaseMapping[] = []

  for (const field of outputSchema) {
    const fieldName = normalizeMappingName(field.name)
    const column = notebaseColumns.find(
      (candidate) =>
        !usedColumnIds.has(candidate.id) &&
        isNotebaseMappingCompatible(field.type, candidate.config) &&
        normalizeMappingName(candidate.name) === fieldName,
    )
    if (column) {
      usedColumnIds.add(column.id)
      mappings.push(createNotebaseMapping(field.id, column.id, column.name))
    }
  }

  return mappings
}

export function resolveNotebaseMappings(
  action: SelectionToolbarCustomAction,
  schema: NotebaseGetSchemaOutput | null | undefined,
): ResolvedNotebaseMapping[] {
  const connection = sanitizeCustomActionNotebaseConnection(
    action.notebaseConnection,
    action.outputSchema,
  )
  if (!connection) {
    return []
  }

  const outputFields = new Map(action.outputSchema.map((field) => [field.id, field]))
  const notebaseColumns = new Map(
    schema?.notebaseColumns.map((column) => [column.id, column]) ?? [],
  )

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

export function validateNotebaseMappings(
  action: SelectionToolbarCustomAction,
  schema: NotebaseGetSchemaOutput,
): NotebaseMappingValidation {
  const resolvedMappings = resolveNotebaseMappings(action, schema)
  if (resolvedMappings.length === 0) {
    return { kind: "empty", resolvedMappings }
  }

  const invalidMapping = resolvedMappings.find(
    (
      mapping,
    ): mapping is ResolvedNotebaseMapping & {
      status: Exclude<ResolvedNotebaseMappingStatus, "valid">
    } => mapping.status !== "valid",
  )
  if (invalidMapping) {
    return {
      kind: "invalid",
      reason: invalidMapping.status,
      resolvedMappings,
    }
  }

  return { kind: "valid", resolvedMappings }
}

/**
 * The action's fields the reader has not decided about: neither mapped to a
 * column nor marked "don't save". A save leaves them out like a skipped field,
 * but reminds the reader about them each time. A mapping whose column is gone is
 * not undecided; it is invalid, and blocks the save until it is fixed.
 */
export function getUndecidedOutputFields(
  action: SelectionToolbarCustomAction,
): SelectionToolbarCustomActionOutputField[] {
  const connection = sanitizeCustomActionNotebaseConnection(
    action.notebaseConnection,
    action.outputSchema,
  )
  if (!connection) {
    return []
  }

  const decidedFieldIds = new Set([
    ...connection.mappings.map((mapping) => mapping.localFieldId),
    ...(connection.skippedFieldIds ?? []),
  ])
  return action.outputSchema.filter((field) => !decidedFieldIds.has(field.id))
}

/** The connection with `fieldId` saved to `column`, replacing what it was before. */
export function mapNotebaseField(
  connection: SelectionToolbarCustomActionNotebaseConnection,
  fieldId: string,
  column: Pick<NotebaseColumn, "id" | "name">,
): SelectionToolbarCustomActionNotebaseConnection {
  const existing = connection.mappings.find((mapping) => mapping.localFieldId === fieldId)
  const mapping = existing
    ? { ...existing, notebaseColumnId: column.id, notebaseColumnNameSnapshot: column.name }
    : createNotebaseMapping(fieldId, column.id, column.name)

  return {
    ...connection,
    mappings: existing
      ? connection.mappings.map((item) => (item === existing ? mapping : item))
      : [...connection.mappings, mapping],
    skippedFieldIds: connection.skippedFieldIds?.filter((id) => id !== fieldId),
  }
}

/** The connection with these fields marked "don't save" (and their mappings removed). */
export function skipNotebaseFields(
  connection: SelectionToolbarCustomActionNotebaseConnection,
  fieldIds: readonly string[],
): SelectionToolbarCustomActionNotebaseConnection {
  const skipped = new Set(fieldIds)
  return {
    ...connection,
    mappings: connection.mappings.filter((mapping) => !skipped.has(mapping.localFieldId)),
    skippedFieldIds: [...new Set([...(connection.skippedFieldIds ?? []), ...fieldIds])],
  }
}

export function buildNotebaseRowCells(
  action: SelectionToolbarCustomAction,
  schema: NotebaseGetSchemaOutput,
  result: Record<string, unknown> | null,
) {
  const cells: NotebaseRowCreateInput["data"]["cells"] = {}
  const resolvedMappings = resolveNotebaseMappings(action, schema)

  for (const resolvedMapping of resolvedMappings) {
    if (
      resolvedMapping.status !== "valid" ||
      !resolvedMapping.localField ||
      !resolvedMapping.notebaseColumn
    ) {
      continue
    }

    cells[resolvedMapping.notebaseColumn.id] = result?.[resolvedMapping.localField.name] ?? null
  }

  return {
    cells,
    resolvedMappings,
  }
}
