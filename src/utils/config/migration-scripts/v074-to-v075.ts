/**
 * Migration script from v074 to v075
 * - Renames Notebase connection config fields from legacy custom-table/column
 *   naming to current notebase/notebase-column naming.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function migrateNotebaseMapping(mapping: any): any {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    return mapping
  }

  const {
    remoteColumnId,
    remoteColumnNameSnapshot,
    ...rest
  } = mapping

  const notebaseColumnId = rest.notebaseColumnId ?? remoteColumnId
  const notebaseColumnNameSnapshot = rest.notebaseColumnNameSnapshot ?? remoteColumnNameSnapshot

  return {
    ...rest,
    ...(notebaseColumnId !== undefined && { notebaseColumnId }),
    ...(notebaseColumnNameSnapshot !== undefined && { notebaseColumnNameSnapshot }),
  }
}

function migrateNotebaseConnection(connection: any): any {
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    return connection
  }

  const {
    tableId,
    tableNameSnapshot,
    mappings,
    ...rest
  } = connection

  const notebaseId = rest.notebaseId ?? tableId
  const notebaseNameSnapshot = rest.notebaseNameSnapshot ?? tableNameSnapshot

  return {
    ...rest,
    ...(notebaseId !== undefined && { notebaseId }),
    ...(notebaseNameSnapshot !== undefined && { notebaseNameSnapshot }),
    ...(Array.isArray(mappings) && {
      mappings: mappings.map(migrateNotebaseMapping),
    }),
    ...(!Array.isArray(mappings) && mappings !== undefined && { mappings }),
  }
}

function migrateCustomAction(action: any): any {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return action
  }

  if (!("notebaseConnection" in action)) {
    return action
  }

  return {
    ...action,
    notebaseConnection: migrateNotebaseConnection(action.notebaseConnection),
  }
}

export function migrate(oldConfig: any): any {
  if (!Array.isArray(oldConfig?.selectionToolbar?.customActions)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig.selectionToolbar,
      customActions: oldConfig.selectionToolbar.customActions.map(migrateCustomAction),
    },
  }
}
