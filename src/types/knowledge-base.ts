import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { ProviderConfig } from "./config/provider"

export const KNOWLEDGE_BASE_SURFACES = [
  "page",
  "node",
  "selection",
  "input",
  "subtitles",
  "translationHub",
] as const

export type KnowledgeBaseSurface = (typeof KNOWLEDGE_BASE_SURFACES)[number]

export interface KnowledgeBaseRemoteSyncConfig {
  enabled: boolean
  endpoint: string
  token: string
}

export interface KnowledgeBaseConfig {
  enabled: boolean
  captureSurfaces: KnowledgeBaseSurface[]
  remoteSync: KnowledgeBaseRemoteSyncConfig
}

export interface TranslationMemoryRecordInput {
  sourceText: string
  translatedText: string
  sourceLang: LangCodeISO6393 | "auto"
  targetLang: LangCodeISO6393
  providerConfig: ProviderConfig
  surface: KnowledgeBaseSurface
  url?: string | null
  title?: string | null
  contextText?: string | null
}

export interface TranslationMemoryItemDTO {
  id: string
  sourceText: string
  translatedText: string
  sourceLang: LangCodeISO6393 | "auto"
  targetLang: LangCodeISO6393
  normalizedSourceHash: string
  providerId: string
  provider: string
  model?: string | null
  createdAt: string
  updatedAt: string
  lastUsedAt: string
  useCount: number
}

export interface TranslationMemoryEventDTO {
  id: string
  itemId: string
  surface: KnowledgeBaseSurface
  url?: string | null
  title?: string | null
  contextText?: string | null
  createdAt: string
}

export interface TranslationMemorySyncPayload {
  schemaVersion: 1
  sourceApp: "readfrog"
  item: TranslationMemoryItemDTO
  event: TranslationMemoryEventDTO
}

export interface TranslationMemoryStats {
  itemCount: number
  eventCount: number
  queuedSyncCount: number
}
