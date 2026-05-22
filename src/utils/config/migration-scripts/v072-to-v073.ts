/**
 * Migration script from v072 to v073
 * - Adds batchSystemPrompt and appendBatchSystemPrompt to every existing
 *   personalized prompt pattern under translate.customPromptsConfig and
 *   videoSubtitles.customPromptsConfig.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

const BATCH_SEPARATOR = "%%"

const DEFAULT_BATCH_TRANSLATE_PROMPT = `## Multi-paragraph Translation Rules
1. If input contains ${BATCH_SEPARATOR}, use ${BATCH_SEPARATOR} in your output, if input has no ${BATCH_SEPARATOR}, don't use ${BATCH_SEPARATOR} in your output
2. **CRITICAL**: Preserve exact formatting around ${BATCH_SEPARATOR} - use exactly one empty line before and after, with no extra spaces, tabs, or whitespace

## OUTPUT FORMAT:
- **Single paragraph input** → Output translation directly (no separators, no extra text)
- **Multi-paragraph input (input uses ${BATCH_SEPARATOR} separators)** → Use ${BATCH_SEPARATOR} as paragraph separator between translations

## Examples

### Multi-paragraph Input:
Paragraph A

${BATCH_SEPARATOR}

Paragraph B

${BATCH_SEPARATOR}

Paragraph C

### Multi-paragraph Output:
Translation A

${BATCH_SEPARATOR}

Translation B

${BATCH_SEPARATOR}

Translation C

### Single paragraph Input:
Single paragraph content

### Single paragraph Output:
Direct translation without separators
`

function addBatchFields(patterns: any[] | undefined): any[] {
  if (!Array.isArray(patterns))
    return []
  return patterns.map(p => ({
    ...p,
    batchSystemPrompt: DEFAULT_BATCH_TRANSLATE_PROMPT,
    appendBatchSystemPrompt: true,
  }))
}

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      customPromptsConfig: {
        ...oldConfig?.translate?.customPromptsConfig,
        patterns: addBatchFields(oldConfig?.translate?.customPromptsConfig?.patterns),
      },
    },
    videoSubtitles: {
      ...oldConfig?.videoSubtitles,
      customPromptsConfig: {
        ...oldConfig?.videoSubtitles?.customPromptsConfig,
        patterns: addBatchFields(oldConfig?.videoSubtitles?.customPromptsConfig?.patterns),
      },
    },
  }
}
