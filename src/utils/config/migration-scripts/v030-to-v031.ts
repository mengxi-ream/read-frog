/**
 * Migration script from v030 to v031
 * 1. Renames 'promptsConfig' → 'customPromptsConfig'
 * 2. Removes 'default' prompt from patterns array (should come from code constant)
 * 3. Renames field 'prompt' → 'promptId'
 * 4. Converts 'default' value → null
 *
 * Before (v030):
 *   promptsConfig: {
 *     prompt: 'default',
 *     patterns: [
 *       { id: 'default', name: 'default', prompt: '...' },
 *       { id: 'uuid1', name: 'Custom', prompt: '...' }
 *     ]
 *   }
 *
 * After (v031):
 *   customPromptsConfig: {
 *     promptId: null,
 *     patterns: [
 *       { id: 'uuid1', name: 'Custom', prompt: '...' }
 *     ]
 *   }
 */

export function migrate(oldConfig: any): any {
  const oldPatterns = oldConfig.translate?.promptsConfig?.patterns ?? []
  const oldPromptValue = oldConfig.translate?.promptsConfig?.prompt ?? null

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      promptsConfig: undefined, // Remove old field
      customPromptsConfig: {
        ...oldConfig.translate?.promptsConfig,
        prompt: undefined, // Remove old field
        promptId: oldPromptValue === 'default' ? null : oldPromptValue,
        patterns: oldPatterns.filter((p: any) => p.id !== 'default'),
      },
    },
  }
}
