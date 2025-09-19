import type { TranslationTask } from '@/utils/request/task-queue'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { DEFAULT_BATCH_CONFIG } from '@/utils/constants/translate'
import { db } from '@/utils/db/dexie/db'
import { onMessage } from '@/utils/message'
import { BatchQueue } from '@/utils/request/batch-queue'
import { TaskQueue } from '@/utils/request/task-queue'
import { ensureInitializedConfig } from './config'

export async function setUpRequestQueue() {
  const config = await ensureInitializedConfig()
  const queueConfig = config?.translate?.requestQueueConfig ?? DEFAULT_CONFIG.translate.requestQueueConfig

  const taskQueue = new TaskQueue(queueConfig.batchConfig || DEFAULT_BATCH_CONFIG)

  const batchQueue = new BatchQueue(
    {
      rate: queueConfig.rate,
      capacity: queueConfig.capacity,
      timeoutMs: 20_000,
      maxRetries: 2,
      baseRetryDelayMs: 1_000,
    },
    queueConfig.batchConfig || DEFAULT_BATCH_CONFIG,
  )

  taskQueue.setBatchQueue(batchQueue)

  onMessage('enqueueTranslateRequest', async (message) => {
    const { data: { text, langConfig, providerConfig, scheduleAt, hash } } = message

    // 缓存检查
    if (hash) {
      const cached = await db.translationCache.get(hash)
      if (cached)
        return cached.translation
    }

    // 创建翻译任务
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
    if (data.rate !== undefined || data.capacity !== undefined) {
      batchQueue.setQueueOptions(data)
    }
    if (data.batchConfig) {
      batchQueue.setBatchConfig(data.batchConfig)
    }
  })
}
