import { browser } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import {
  clearTranslationMemory,
  exportTranslationMemory,
  getTranslationMemoryStats,
  recordTranslationMemory,
  retryKnowledgeSyncQueue,
  testKnowledgeBaseSync,
} from "@/utils/knowledge-base/translation-memory"
import { ensureInitializedConfig } from "./config"

export const KNOWLEDGE_SYNC_RETRY_ALARM = "knowledge-sync-retry"
const KNOWLEDGE_SYNC_RETRY_INTERVAL_MINUTES = 15

export function setupKnowledgeBaseMessageHandlers() {
  onMessage("recordTranslationMemory", async (message) => {
    const config = await ensureInitializedConfig() ?? DEFAULT_CONFIG
    await recordTranslationMemory(message.data, config)
  })

  onMessage("exportTranslationMemory", async (message) => {
    return await exportTranslationMemory(message.data?.format)
  })

  onMessage("clearTranslationMemory", async () => {
    await clearTranslationMemory()
  })

  onMessage("getTranslationMemoryStats", async () => {
    return await getTranslationMemoryStats()
  })

  onMessage("testKnowledgeBaseSync", async (message) => {
    return await testKnowledgeBaseSync(message.data)
  })
}

export async function setupKnowledgeBaseSyncRetry() {
  const existingAlarm = await browser.alarms.get(KNOWLEDGE_SYNC_RETRY_ALARM)
  if (!existingAlarm) {
    void browser.alarms.create(KNOWLEDGE_SYNC_RETRY_ALARM, {
      delayInMinutes: KNOWLEDGE_SYNC_RETRY_INTERVAL_MINUTES,
      periodInMinutes: KNOWLEDGE_SYNC_RETRY_INTERVAL_MINUTES,
    })
  }

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== KNOWLEDGE_SYNC_RETRY_ALARM) {
      return
    }

    void ensureInitializedConfig()
      .then(config => retryKnowledgeSyncQueue(config ?? DEFAULT_CONFIG))
      .catch(error => logger.warn("Failed to retry knowledge base sync", error))
  })
}
