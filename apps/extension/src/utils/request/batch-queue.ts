import type { BatchQueueOptions, BatchTask, TranslationTask } from './types'
import { deepmerge } from 'deepmerge-ts'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { BATCH_SEPARATOR } from '@/utils/constants/prompt'
import { executeTranslate } from '@/utils/host/translate/translate-text'
import { BinaryHeapPQ } from './priority-queue'

export class BatchQueue {
  private waitingQueue: BinaryHeapPQ<BatchTask & { hash: string }>
  private waitingBatches = new Map<string, BatchTask>()
  private executingBatches = new Map<string, BatchTask>()
  private nextScheduleTimer: NodeJS.Timeout | null = null

  private bucketTokens: number
  private lastRefill: number

  constructor(
    private options: BatchQueueOptions,
  ) {
    this.bucketTokens = options.capacity
    this.lastRefill = Date.now()
    this.waitingQueue = new BinaryHeapPQ<BatchTask & { hash: string }>()
  }

  enqueue(batch: BatchTask): void {
    batch.thunk = () => this.executeBatchTranslation(batch.tasks)

    this.enqueueBatch(batch)
  }

  private enqueueBatch(batch: BatchTask): void {
    const hash = this.generateBatchHash(batch)

    this.waitingBatches.set(hash, batch)
    this.waitingQueue.push({ ...batch, hash }, batch.scheduleAt)

    this.schedule()
  }

  private schedule() {
    this.refillTokens()

    while (this.bucketTokens >= 1 && this.waitingQueue.size() > 0) {
      const batch = this.waitingQueue.peek()
      if (batch && batch.scheduleAt <= Date.now()) {
        this.waitingQueue.pop()
        this.waitingBatches.delete(this.generateBatchHash(batch))
        this.executingBatches.set(this.generateBatchHash(batch), batch)
        this.bucketTokens--
        void this.executeBatch(batch)
      }
      else {
        break
      }
    }

    if (this.nextScheduleTimer) {
      clearTimeout(this.nextScheduleTimer)
      this.nextScheduleTimer = null
    }

    if (this.waitingQueue.size() > 0) {
      const nextBatch = this.waitingQueue.peek()
      if (nextBatch) {
        const now = Date.now()
        const delayUntilScheduled = Math.max(0, nextBatch.scheduleAt - now)
        const msUntilNextToken = this.bucketTokens >= 1
          ? 0
          : Math.ceil((1 - this.bucketTokens) / this.options.rate * 1000)
        const delay = Math.max(delayUntilScheduled, msUntilNextToken)

        this.nextScheduleTimer = setTimeout(() => {
          this.nextScheduleTimer = null
          this.schedule()
        }, delay)
      }
    }
  }

  private async executeBatch(batch: BatchTask & { hash: string }) {
    let timeoutId: NodeJS.Timeout | null = null

    const clearTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Batch ${batch.id} timed out after ${this.options.timeoutMs}ms`))
        }, this.options.timeoutMs)
      })

      const results = await Promise.race([
        batch.thunk?.(),
        timeoutPromise,
      ])

      clearTimer()

      if (!results) {
        throw new Error('Translation results are undefined')
      }

      if (results.length !== batch.tasks.length) {
        throw new Error(`Translation count mismatch: expected ${batch.tasks.length}, got ${results.length}`)
      }

      batch.tasks.forEach((task, index) => task.resolve?.(results[index]))
    }
    catch (error) {
      clearTimer()

      if (batch.retryCount < this.options.maxRetries) {
        batch.retryCount++

        const backoffDelayMs = this.options.baseRetryDelayMs * (2 ** (batch.retryCount - 1))
        const jitter = Math.random() * 0.1 * backoffDelayMs
        const delayMs = backoffDelayMs + jitter

        batch.scheduleAt = Date.now() + delayMs

        this.waitingBatches.set(batch.hash, batch)
        this.waitingQueue.push(batch, batch.scheduleAt)
        this.schedule()
      }
      else {
        batch.tasks.forEach(task => task.reject?.(error as Error))
      }
    }
    finally {
      clearTimer()

      this.executingBatches.delete(batch.hash)
      this.schedule()
    }
  }

  private refillTokens() {
    const now = Date.now()
    const timeSinceLastRefill = now - this.lastRefill
    const tokensToAdd = (timeSinceLastRefill / 1000) * this.options.rate
    this.bucketTokens = Math.min(this.bucketTokens + tokensToAdd, this.options.capacity)
    this.lastRefill = now
  }

  private async executeBatchTranslation(tasks: TranslationTask[]): Promise<string[]> {
    const { langConfig, providerConfig } = tasks[0]

    if (isLLMTranslateProviderConfig(providerConfig)) {
      const inputs = tasks.map(task => task.text)
      const text = inputs.join(BATCH_SEPARATOR)
      const result = await executeTranslate(text, langConfig, providerConfig, { isBatch: true })
      return result.split(BATCH_SEPARATOR).map(t => t.trim())
    }

    const translationPromises = tasks.map(task =>
      executeTranslate(task.text, task.langConfig, task.providerConfig),
    )

    return await Promise.all(translationPromises)
  }

  private generateBatchHash(batch: BatchTask): string {
    return `batch-${batch.id}`
  }

  setQueueOptions(options: Partial<BatchQueueOptions>) {
    this.options = deepmerge(this.options, options) as BatchQueueOptions
    if (options.capacity) {
      this.bucketTokens = options.capacity
      this.lastRefill = Date.now()
    }
  }
}
