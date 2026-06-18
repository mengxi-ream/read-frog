/**
 * Migration script from v031 to v032
 * Adds 'enableLLMDetection' field to translate.page config
 *
 * Before (v031):
 *   translate: {
 *     page: {
 *       range: 'main',
 *       autoTranslatePatterns: [...],
 *       autoTranslateLanguages: [...],
 *       shortcut: [...]
 *     }
 *   }
 *
 * After (v032):
 *   translate: {
 *     page: {
 *       range: 'main',
 *       autoTranslatePatterns: [...],
 *       autoTranslateLanguages: [...],
 *       shortcut: [...],
 *       enableLLMDetection: false
 *     }
 *   }
 */
export function migrate(oldConfig) {
    return {
        ...oldConfig,
        translate: {
            ...oldConfig.translate,
            page: {
                ...oldConfig.translate?.page,
                enableLLMDetection: false,
            },
        },
    };
}
