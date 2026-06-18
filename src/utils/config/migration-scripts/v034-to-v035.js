/**
 * Migration script from v034 to v035
 * Adds 'contextMenu' configuration for right-click menu translation feature
 *
 * Before (v034):
 *   { language: {...}, translate: {...}, ... }
 *
 * After (v035):
 *   { language: {...}, translate: {...}, contextMenu: { enabled: true }, ... }
 */
export function migrate(oldConfig) {
    return {
        ...oldConfig,
        contextMenu: {
            enabled: true,
        },
    };
}
