import type {
  NotebaseColumn,
  NotebaseGetSchemaOutput,
  NotebaseRowCreateInput,
} from "@read-frog/api-contract"
import type { NotebaseColumnConfig } from "@read-frog/definitions"
import type {
  SelectionToolbarCustomAction,
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

/** The action's fields no valid mapping writes: a save leaves them out of the note. */
export function getUnmappedOutputFields(
  action: SelectionToolbarCustomAction,
  schema: NotebaseGetSchemaOutput,
): SelectionToolbarCustomActionOutputField[] {
  const mappedFieldIds = new Set(
    resolveNotebaseMappings(action, schema)
      .filter((resolvedMapping) => resolvedMapping.status === "valid")
      .map((resolvedMapping) => resolvedMapping.mapping.localFieldId),
  )

  return action.outputSchema.filter((field) => !mappedFieldIds.has(field.id))
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
