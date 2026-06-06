import type { KnowledgeBaseSurface } from "@/types/knowledge-base"
import { Entity } from "dexie"

export default class TranslationMemoryEvent extends Entity {
  id!: string
  itemId!: string
  surface!: KnowledgeBaseSurface
  url?: string | null
  title?: string | null
  contextText?: string | null
  createdAt!: Date
}
