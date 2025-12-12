/**
 * Migration script from v037 to v038
 * Adds 'clickAction' field to floatingButton config
 *
 * Before (v037):
 *   { floatingButton: { enabled, position, disabledFloatingButtonPatterns }, ... }
 *
 * After (v038):
 *   { floatingButton: { enabled, position, disabledFloatingButtonPatterns, clickAction: 'panel' }, ... }
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    floatingButton: {
      ...oldConfig.floatingButton,
      clickAction: 'panel',
    },
  }
}
