import type { TranslationTask } from '@/utils/request/types'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { db } from '@/utils/db/dexie/db'
import { onMessage } from '@/utils/message'
import { BatchQueue } from '@/utils/request/batch-queue'
import { TaskQueue } from '@/utils/request/task-queue'
import { ensureInitializedConfig } from './config'

export async function setUpRequestQueue() {
  const config = await ensureInitializedConfig()
  const queueConfig = config?.translate?.requestQueueConfig ?? DEFAULT_CONFIG.translate.requestQueueConfig
  const batchConfig = config?.translate?.requestBatchConfig ?? DEFAULT_CONFIG.translate.requestBatchConfig

  const taskQueue = new TaskQueue(batchConfig)

  const batchQueue = new BatchQueue(
    {
      rate: queueConfig.rate,
      capacity: queueConfig.capacity,
      timeoutMs: 20_000,
      maxRetries: 2,
      baseRetryDelayMs: 1_000,
    },
  )

  taskQueue.setBatchQueue(batchQueue)

  onMessage('enqueueTranslateRequest', async (message) => {
    const { data: { text, langConfig, providerConfig, scheduleAt, hash } } = message

    // Check cache
    if (hash) {
      const cached = await db.translationCache.get(hash)
      if (cached)
        return cached.translation
    }

    // Create translation task
    let resolve!: (value: string) => void
    let reject!: (error: Error) => void
    const promise = new Promise<string>((res, rej) => {
      resolve = res
      reject = rej
    })

    const task: TranslationTask = {
      id: crypto.randomUUID(),
      text,
      hash,
      langConfig,
      providerConfig,
      scheduleAt,
      createdAt: Date.now(),
      resolve,
      reject,
      promise,
    }

    const result = await taskQueue.enqueue(task)

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
    batchQueue.setQueueOptions(data)
  })

  onMessage('setTranslateRequestBatchConfig', (message) => {
    const { data } = message
    taskQueue.setBatchConfig(data)
  })
}
