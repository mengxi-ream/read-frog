import type { KnowledgeBaseConfig } from "@/types/knowledge-base"

export const DEFAULT_KNOWLEDGE_BASE_CONFIG: KnowledgeBaseConfig = {
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
