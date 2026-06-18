/**
 * Migration script from v032 to v033
 * Adds 'enableAIContentAware' field to translate config
 *
 * Before (v032):
 *   translate: {
 *     providerId: 'microsoft-default',
 *     mode: 'bilingual',
 *     node: {...},
 *     page: {...},
 *     customPromptsConfig: {...},
 *     ...
 *   }
 *
 * After (v033):
 *   translate: {
 *     providerId: 'microsoft-default',
 *     mode: 'bilingual',
 *     node: {...},
 *     page: {...},
 *     enableAIContentAware: false,
 *     customPromptsConfig: {...},
 *     ...
 *   }
 */
export function migrate(oldConfig) {
    return {
        ...oldConfig,
        translate: {
            ...oldConfig.translate,
            enableAIContentAware: false,
        },
    };
}
