import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type {
  KnowledgeBaseConfig,
  KnowledgeBaseSurface,
  TranslationMemoryEventDTO,
  TranslationMemoryItemDTO,
  TranslationMemoryRecordInput,
  TranslationMemoryStats,
  TranslationMemorySyncPayload,
} from "@/types/knowledge-base"
import type { LangCodeISO6393 } from "@read-frog/definitions"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { logger } from "@/utils/logger"
import { getRandomUUID } from "../crypto-polyfill"

export type TranslationMemoryExportFormat = "jsonl" | "json"

interface TranslationMemoryItemRecord {
  id: string
  sourceText: string
  translatedText: string
  sourceLang: LangCodeISO6393 | "auto"
  targetLang: LangCodeISO6393
  normalizedSourceHash: string
  dedupeKey: string
  providerId: string
  provider: string
  model?: string | null
  createdAt: Date
  updatedAt: Date
  lastUsedAt: Date
  useCount: number
  surfaces: KnowledgeBaseSurface[]
}

interface TranslationMemoryEventRecord {
  id: string
  itemId: string
  surface: KnowledgeBaseSurface
  url?: string | null
  title?: string | null
  contextText?: string | null
  createdAt: Date
}

function normalizeSourceText(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function dateToISO(date: Date): string {
  return date.toISOString()
}

function resolveProviderModel(providerConfig: ProviderConfig): string | null {
  if (!("model" in providerConfig)) {
    return null
  }

  const model = providerConfig.model
  return model.isCustomModel
    ? model.customModel?.trim() || null
    : model.model?.trim() || null
}

function buildDedupeKey(input: Pick<TranslationMemoryRecordInput, "sourceText" | "sourceLang" | "targetLang" | "providerConfig">) {
  const normalizedSourceHash = Sha256Hex(normalizeSourceText(input.sourceText))
  return {
    normalizedSourceHash,
    dedupeKey: Sha256Hex(
      normalizedSourceHash,
      input.sourceLang,
      input.targetLang,
      input.providerConfig.id,
    ),
  }
}

function toItemDTO(item: TranslationMemoryItemRecord): TranslationMemoryItemDTO {
  return {
    id: item.id,
    sourceText: item.sourceText,
    translatedText: item.translatedText,
    sourceLang: item.sourceLang,
    targetLang: item.targetLang,
    normalizedSourceHash: item.normalizedSourceHash,
    providerId: item.providerId,
    provider: item.provider,
    model: item.model ?? null,
    createdAt: dateToISO(item.createdAt),
    updatedAt: dateToISO(item.updatedAt),
    lastUsedAt: dateToISO(item.lastUsedAt),
    useCount: item.useCount,
  }
}

function toEventDTO(event: TranslationMemoryEventRecord): TranslationMemoryEventDTO {
  return {
    id: event.id,
    itemId: event.itemId,
    surface: event.surface,
    url: event.url ?? null,
    title: event.title ?? null,
    contextText: event.contextText ?? null,
    createdAt: dateToISO(event.createdAt),
  }
}

function createSyncPayload(item: TranslationMemoryItemRecord, event: TranslationMemoryEventRecord): TranslationMemorySyncPayload {
  return {
    schemaVersion: 1,
    sourceApp: "readfrog",
    item: toItemDTO(item),
    event: toEventDTO(event),
  }
}

function shouldRecordTranslation(input: TranslationMemoryRecordInput, config: Config): boolean {
  if (!config.knowledgeBase.enabled) {
    return false
  }

  if (!config.knowledgeBase.captureSurfaces.includes(input.surface)) {
    return false
  }

  return normalizeSourceText(input.sourceText) !== "" && input.translatedText.trim() !== ""
}

async function postSyncPayload(remoteSync: KnowledgeBaseConfig["remoteSync"], payload: TranslationMemorySyncPayload): Promise<void> {
  const endpoint = remoteSync.endpoint.trim()
  if (!endpoint) {
    throw new Error("Knowledge base endpoint is empty")
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  const token = remoteSync.token.trim()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Knowledge base sync failed: ${response.status} ${response.statusText}`)
  }
}

async function enqueueSyncPayload(payload: TranslationMemorySyncPayload, error: unknown): Promise<void> {
  const now = new Date()
  await db.knowledgeSyncQueue.put({
    id: getRandomUUID(),
    payload,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    lastError: error instanceof Error ? error.message : String(error),
  })
}

export async function syncPayloadOrQueue(remoteSync: KnowledgeBaseConfig["remoteSync"], payload: TranslationMemorySyncPayload): Promise<void> {
  if (!remoteSync.enabled) {
    return
  }

  try {
    await postSyncPayload(remoteSync, payload)
  }
  catch (error) {
    await enqueueSyncPayload(payload, error)
    logger.warn("Queued translation memory sync payload after failure", error)
  }
}

export async function recordTranslationMemory(input: TranslationMemoryRecordInput, config: Config): Promise<void> {
  if (!shouldRecordTranslation(input, config)) {
    return
  }

  const now = new Date()
  const normalizedSourceText = normalizeSourceText(input.sourceText)
  const { dedupeKey, normalizedSourceHash } = buildDedupeKey(input)
  const existingItem = await db.translationMemoryItems
    .where("dedupeKey")
    .equals(dedupeKey)
    .first()

  const item = existingItem
    ? {
        ...existingItem,
        sourceText: existingItem.sourceText || input.sourceText,
        translatedText: input.translatedText,
        updatedAt: now,
        lastUsedAt: now,
        useCount: existingItem.useCount + 1,
        surfaces: Array.from(new Set([...(existingItem.surfaces ?? []), input.surface])),
      }
    : {
        id: getRandomUUID(),
        sourceText: normalizedSourceText,
        translatedText: input.translatedText,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        normalizedSourceHash,
        dedupeKey,
        providerId: input.providerConfig.id,
        provider: input.providerConfig.provider,
        model: resolveProviderModel(input.providerConfig),
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
        useCount: 1,
        surfaces: [input.surface],
      }

  await db.translationMemoryItems.put(item)

  const event = {
    id: getRandomUUID(),
    itemId: item.id,
    surface: input.surface,
    url: normalizeOptionalText(input.url),
    title: normalizeOptionalText(input.title),
    contextText: normalizeOptionalText(input.contextText),
    createdAt: now,
  }

  await db.translationMemoryEvents.put(event)

  await syncPayloadOrQueue(config.knowledgeBase.remoteSync, createSyncPayload(item, event))
}

export async function retryKnowledgeSyncQueue(config: Pick<Config, "knowledgeBase">): Promise<void> {
  const remoteSync = config.knowledgeBase.remoteSync
  if (!remoteSync.enabled) {
    return
  }

  const queuedItems = await db.knowledgeSyncQueue
    .orderBy("createdAt")
    .limit(50)
    .toArray()

  for (const queued of queuedItems) {
    try {
      await postSyncPayload(remoteSync, queued.payload)
      await db.knowledgeSyncQueue.delete(queued.id)
    }
    catch (error) {
      await db.knowledgeSyncQueue.put({
        ...queued,
        attempts: queued.attempts + 1,
        updatedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export async function exportTranslationMemory(format: TranslationMemoryExportFormat = "jsonl"): Promise<string> {
  const [items, events] = await Promise.all([
    db.translationMemoryItems.orderBy("createdAt").toArray(),
    db.translationMemoryEvents.orderBy("createdAt").toArray(),
  ])

  const eventsByItemId = new Map<string, TranslationMemoryEventRecord[]>()
  for (const event of events) {
    const itemEvents = eventsByItemId.get(event.itemId) ?? []
    itemEvents.push(event)
    eventsByItemId.set(event.itemId, itemEvents)
  }

  const records = items.map(item => ({
    item: toItemDTO(item),
    events: (eventsByItemId.get(item.id) ?? []).map(toEventDTO),
  }))

  if (format === "json") {
    return JSON.stringify({
      schemaVersion: 1,
      sourceApp: "readfrog",
      exportedAt: new Date().toISOString(),
      records,
    }, null, 2)
  }

  return records.map(record => JSON.stringify({
    schemaVersion: 1,
    sourceApp: "readfrog",
    ...record,
  })).join("\n")
}

export async function clearTranslationMemory(): Promise<void> {
  await Promise.all([
    db.translationMemoryItems.clear(),
    db.translationMemoryEvents.clear(),
    db.knowledgeSyncQueue.clear(),
  ])
}

export async function getTranslationMemoryStats(): Promise<TranslationMemoryStats> {
  const [itemCount, eventCount, queuedSyncCount] = await Promise.all([
    db.translationMemoryItems.count(),
    db.translationMemoryEvents.count(),
    db.knowledgeSyncQueue.count(),
  ])

  return { itemCount, eventCount, queuedSyncCount }
}

export async function testKnowledgeBaseSync(data: { endpoint: string, token?: string }): Promise<{ ok: boolean, message?: string }> {
  try {
    await postSyncPayload(
      {
        enabled: true,
        endpoint: data.endpoint,
        token: data.token ?? "",
      },
      {
        schemaVersion: 1,
        sourceApp: "readfrog",
        item: {
          id: "test-item",
          sourceText: "Read Frog test",
          translatedText: "Read Frog test",
          sourceLang: "eng",
          targetLang: "cmn",
          normalizedSourceHash: Sha256Hex("Read Frog test"),
          providerId: "test-provider",
          provider: "test",
          model: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          lastUsedAt: new Date(0).toISOString(),
          useCount: 1,
        },
        event: {
          id: "test-event",
          itemId: "test-item",
          surface: "translationHub",
          url: null,
          title: "Read Frog knowledge base test",
          contextText: null,
          createdAt: new Date(0).toISOString(),
        },
      },
    )
    return { ok: true }
  }
  catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
