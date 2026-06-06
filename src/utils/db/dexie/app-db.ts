import type { EntityTable } from "dexie"
import { upperCamelCase } from "case-anything"
import Dexie from "dexie"
import { APP_NAME } from "@/utils/constants/app"
import AiSegmentationCache from "./tables/ai-segmentation-cache"
import ArticleSummaryCache from "./tables/article-summary-cache"
import BatchRequestRecord from "./tables/batch-request-record"
import KnowledgeSyncQueue from "./tables/knowledge-sync-queue"
import TranslationMemoryEvent from "./tables/translation-memory-event"
import TranslationMemoryItem from "./tables/translation-memory-item"
import TranslationCache from "./tables/translation-cache"

export default class AppDB extends Dexie {
  translationCache!: EntityTable<
    TranslationCache,
    "key"
  >

  batchRequestRecord!: EntityTable<
    BatchRequestRecord,
    "key"
  >

  articleSummaryCache!: EntityTable<
    ArticleSummaryCache,
    "key"
  >

  aiSegmentationCache!: EntityTable<
    AiSegmentationCache,
    "key"
  >

  translationMemoryItems!: EntityTable<
    TranslationMemoryItem,
    "id"
  >

  translationMemoryEvents!: EntityTable<
    TranslationMemoryEvent,
    "id"
  >

  knowledgeSyncQueue!: EntityTable<
    KnowledgeSyncQueue,
    "id"
  >

  constructor() {
    super(`${upperCamelCase(APP_NAME)}DB`)
    this.version(1).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
    })
    this.version(2).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
    })
    this.version(3).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
      articleSummaryCache: `
        key,
        createdAt`,
    })
    this.version(4).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
      articleSummaryCache: `
        key,
        createdAt`,
      aiSegmentationCache: `
        key,
        createdAt`,
    })
    this.version(5).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
      articleSummaryCache: `
        key,
        createdAt`,
      aiSegmentationCache: `
        key,
        createdAt`,
      translationMemoryItems: `
        id,
        dedupeKey,
        normalizedSourceHash,
        sourceLang,
        targetLang,
        providerId,
        provider,
        createdAt,
        updatedAt,
        lastUsedAt`,
      translationMemoryEvents: `
        id,
        itemId,
        surface,
        url,
        createdAt`,
      knowledgeSyncQueue: `
        id,
        createdAt,
        updatedAt,
        attempts`,
    })
    this.translationCache.mapToClass(TranslationCache)
    this.batchRequestRecord.mapToClass(BatchRequestRecord)
    this.articleSummaryCache.mapToClass(ArticleSummaryCache)
    this.aiSegmentationCache.mapToClass(AiSegmentationCache)
    this.translationMemoryItems.mapToClass(TranslationMemoryItem)
    this.translationMemoryEvents.mapToClass(TranslationMemoryEvent)
    this.knowledgeSyncQueue.mapToClass(KnowledgeSyncQueue)
  }
}
