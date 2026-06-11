/**
 * Migration script from v075 to v076
 * - Backfills required Notebase connected account snapshots.
 *
 * v075 did not store the account that created a Notebase connection, so every
 * existing connection receives the same migrated placeholder.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

const MIGRATED_CONNECTED_ACCOUNT = {
  id: "__read_frog_migrated_notebase_connection__",
  name: "Migrated Notebase connection",
  email: "migrated-notebase-connection@readfrog.local",
  image: null,
}

function migrateNotebaseConnection(connection: any): any {
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    return connection
  }

  return {
    ...connection,
    connectedAccount: MIGRATED_CONNECTED_ACCOUNT,
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
