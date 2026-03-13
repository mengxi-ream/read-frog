/**
 * Migration script from v060 to v061
 * - Adds `speaking` to custom action output schema fields
 * - Enables speaking for known dictionary template fields: `Term` and `Context`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const selectionToolbar = oldConfig.selectionToolbar

  if (!selectionToolbar || !Array.isArray(selectionToolbar.customActions)) {
    return oldConfig
  }

  const customActions = selectionToolbar.customActions.map((action: any) => {
    if (!Array.isArray(action.outputSchema)) {
      return action
    }

    const outputSchema = action.outputSchema.map((field: any) => ({
      ...field,
      speaking: field.speaking ?? (
        field.id === "dictionary-term"
        || field.id === "dictionary-context"
        || field.id === "default-dictionary-term"
        || field.id === "default-dictionary-context"
      ),
    }))

    return {
      ...action,
      outputSchema,
    }
  })

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      customActions,
    },
  }
}
