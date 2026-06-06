/**
 * Migration script from v073 to v074
 * - Adds knowledgeBase settings for long-term translation memory.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

const DEFAULT_KNOWLEDGE_BASE = {
  enabled: true,
  captureSurfaces: [
    "page",
    "node",
    "selection",
    "input",
    "subtitles",
    "translationHub",
  ],
  remoteSync: {
    enabled: false,
    endpoint: "",
    token: "",
  },
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig)) {
    return oldConfig
  }

  if (isRecord(oldConfig.knowledgeBase)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    knowledgeBase: DEFAULT_KNOWLEDGE_BASE,
  }
}
