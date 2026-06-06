import type { TranslationMemorySyncPayload } from "@/types/knowledge-base"
import { Entity } from "dexie"

export default class KnowledgeSyncQueue extends Entity {
  id!: string
  payload!: TranslationMemorySyncPayload
  createdAt!: Date
  updatedAt!: Date
  attempts!: number
  lastError?: string | null
}
