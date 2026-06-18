/**
 * Migration script from v066 to v067
 * - Renames subtitle prompt tokens:
 *   - {{webTitle}} -> {{videoTitle}}
 *   - {{webSummary}} -> {{videoSummary}}
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
function replaceSubtitlePromptTokens(text) {
    if (typeof text !== "string") {
        return text;
    }
    return text
        .replaceAll("{{webTitle}}", "{{videoTitle}}")
        .replaceAll("{{webSummary}}", "{{videoSummary}}");
}
function migrateCustomPromptsConfig(config) {
    if (!config || !Array.isArray(config.patterns)) {
        return config;
    }
    return {
        ...config,
        patterns: config.patterns.map((pattern) => ({
            ...pattern,
            systemPrompt: replaceSubtitlePromptTokens(pattern.systemPrompt),
            prompt: replaceSubtitlePromptTokens(pattern.prompt),
        })),
    };
}
export function migrate(oldConfig) {
    return {
        ...oldConfig,
        videoSubtitles: {
            ...oldConfig?.videoSubtitles,
            customPromptsConfig: migrateCustomPromptsConfig(oldConfig?.videoSubtitles?.customPromptsConfig),
        },
    };
}
