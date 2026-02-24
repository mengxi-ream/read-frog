/**
 * Migration script from v033 to v034
 * Adds 'systemPrompt' field to custom translate prompt patterns
 *
 * Before (v033):
 *   translate: {
 *     customPromptsConfig: {
 *       promptId: 'uuid-123',
 *       patterns: [
 *         { id: 'uuid-123', name: 'Custom', prompt: '...' }
 *       ]
 *     }
 *   }
 *
 * After (v034):
 *   translate: {
 *     customPromptsConfig: {
 *       promptId: 'uuid-123',
 *       patterns: [
 *         { id: 'uuid-123', name: 'Custom', systemPrompt: '', prompt: '...' }
 *       ]
 *     }
 *   }
 */

export function migrate(oldConfig: any): any {
  const patterns = oldConfig.translate?.customPromptsConfig?.patterns ?? []

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      customPromptsConfig: {
        ...oldConfig.translate?.customPromptsConfig,
        patterns: patterns.map((pattern: any) => ({
          ...pattern,
          systemPrompt: "",
        })),
      },
    },
  }
}
