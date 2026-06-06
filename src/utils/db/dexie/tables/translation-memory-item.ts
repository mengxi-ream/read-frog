import type { KnowledgeBaseSurface } from "@/types/knowledge-base"
import type { LangCodeISO6393 } from "@read-frog/definitions"
import { Entity } from "dexie"

export default class TranslationMemoryItem extends Entity {
  id!: string
  sourceText!: string
  translatedText!: string
  sourceLang!: LangCodeISO6393 | "auto"
  targetLang!: LangCodeISO6393
  normalizedSourceHash!: string
  dedupeKey!: string
  providerId!: string
  provider!: string
  model?: string | null
  createdAt!: Date
  updatedAt!: Date
  lastUsedAt!: Date
  useCount!: number
  surfaces!: KnowledgeBaseSurface[]
}
