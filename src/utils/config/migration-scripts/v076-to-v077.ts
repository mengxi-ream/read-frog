/**
 * Migration script from v076 to v077
 * - Renames subtitle prompt title token:
 *   - {{videoTitle}} -> {{webTitle}}
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

function replaceSubtitlePromptTokens(text: any): any {
  if (typeof text !== "string") {
    return text
  }

  return text.replaceAll("{{videoTitle}}", "{{webTitle}}")
}

function migrateCustomPromptsConfig(config: any): any {
  if (!config || !Array.isArray(config.patterns)) {
    return config
  }

  return {
    ...config,
    patterns: config.patterns.map((pattern: any) => ({
      ...pattern,
      systemPrompt: replaceSubtitlePromptTokens(pattern.systemPrompt),
      prompt: replaceSubtitlePromptTokens(pattern.prompt),
    })),
  }
}

export function migrate(oldConfig: any): any {
  if (!oldConfig?.videoSubtitles) {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      customPromptsConfig: migrateCustomPromptsConfig(oldConfig.videoSubtitles.customPromptsConfig),
    },
  }
}
