/**
 * Migration script from v067 to v068
 * - Adds `floatingButton.locked` with a default value of `false`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig) {
    return {
        ...oldConfig,
        floatingButton: {
            ...oldConfig?.floatingButton,
            locked: oldConfig?.floatingButton?.locked ?? false,
        },
    };
}
