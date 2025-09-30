import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { BATCH_SEPARATOR } from '@/utils/constants/prompt'
import { db } from '@/utils/db/dexie/db'
import { Sha256Hex } from '@/utils/hash'
import { executeTranslate } from '@/utils/host/translate/translate-text'
import { onMessage } from '@/utils/message'
import { BatchQueue } from '@/utils/request/batch-queue'
import { RequestQueue } from '@/utils/request/request-queue'
import { ensureInitializedConfig } from './config'

interface TranslateBatchData {
  text: string
  langConfig: Config['language']
  providerConfig: ProviderConfig
  hash: string
}

export async function setUpRequestQueue() {
  const config = await ensureInitializedConfig()
  const { translate: { requestQueueConfig: { rate, capacity }, batchQueueConfig: { maxCharactersPerBatch, maxItemsPerBatch } } } = config ?? DEFAULT_CONFIG

  const requestQueue = new RequestQueue({
    rate,
    capacity,
    timeoutMs: 20_000,
    maxRetries: 2,
    baseRetryDelayMs: 1_000,
  })

  const batchQueue = new BatchQueue<TranslateBatchData, string>({
    maxCharactersPerBatch,
    maxItemsPerBatch,
    batchDelay: 100,
    getBatchKey: (data) => {
      return Sha256Hex(`${data.langConfig.sourceCode}-${data.langConfig.targetCode}-${data.providerConfig.id}`)
    },
    getCharacters: (data) => {
      return data.text.length
    },
    executeBatch: async (dataList) => {
      const { langConfig, providerConfig } = dataList[0]
      const texts = dataList.map(d => d.text)
      const batchText = texts.join(BATCH_SEPARATOR)
      const hash = Sha256Hex(...dataList.map(d => d.hash))

      const batchThunk = async (): Promise<string[]> => {
        const result = await executeTranslate(batchText, langConfig, providerConfig, { isBatch: true })
        return result.split(BATCH_SEPARATOR).map(t => t.trim())
      }

      return requestQueue.enqueue(batchThunk, Date.now(), hash)
    },
  })

  onMessage('enqueueTranslateRequest', async (message) => {
    const { data: { text, langConfig, providerConfig, scheduleAt, hash } } = message

    // Check cache first
    if (hash) {
      const cached = await db.translationCache.get(hash)
      if (cached) {
        return cached.translation
      }
    }

    let result = ''

    if (isLLMTranslateProviderConfig(providerConfig)) {
      const data = { text, langConfig, providerConfig, hash }
      result = await batchQueue.enqueue(data)
    }
    else {
      // Create thunk based on type and params
      const thunk = () => executeTranslate(text, langConfig, providerConfig)
      result = await requestQueue.enqueue(thunk, scheduleAt, hash)
    }

    // Cache the translation result if successful
    if (result && hash) {
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage('setTranslateRequestQueueConfig', (message) => {
    const { data } = message
    requestQueue.setQueueOptions(data)
  })

  onMessage('setTranslateBatchQueueConfig', (message) => {
    const { data } = message
    batchQueue.setBatchConfig(data)
  })
}
