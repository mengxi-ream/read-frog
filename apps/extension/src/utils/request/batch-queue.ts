import type { BatchConfig, BatchQueueOptions, BatchTask } from './batch-types'
import type { TaskQueue, TranslationTask } from './task-queue'
import { LANG_CODE_TO_EN_NAME } from '@repo/definitions'
import { deepmerge } from 'deepmerge-ts'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { db } from '@/utils/db/dexie/db'
import { executeTranslate } from '@/utils/host/translate/translate-text'
import { logger } from '@/utils/logger'
import { BinaryHeapPQ } from './priority-queue'

export class BatchQueue {
  // 沿用现有RequestQueue的核心数据结构
  private waitingQueue: BinaryHeapPQ<BatchTask & { hash: string }>
  private waitingBatches = new Map<string, BatchTask>()
  private executingBatches = new Map<string, BatchTask>()
  private nextScheduleTimer: NodeJS.Timeout | null = null

  // 沿用现有token bucket逻辑
  private bucketTokens: number
  private lastRefill: number

  private taskQueue: TaskQueue
  private batchConfig: BatchConfig
  private taskRetryCounter = new Map<string, number>()

  constructor(
    taskQueue: TaskQueue,
    private options: BatchQueueOptions,
    batchConfig: BatchConfig,
  ) {
    this.taskQueue = taskQueue
    this.batchConfig = batchConfig
    this.bucketTokens = options.capacity
    this.lastRefill = Date.now()
    this.waitingQueue = new BinaryHeapPQ<BatchTask & { hash: string }>()

    // 建立双向引用
    taskQueue.setBatchQueue(this)
  }

  // 任务队列推送：接收组装好的批量任务
  enqueue(batch: BatchTask): void {
    // 设置批量任务的执行函数
    batch.thunk = () => this.executeBatchTranslation(batch.tasks)

    this.enqueueBatch(batch)
  }

  private enqueueBatch(batch: BatchTask): void {
    const hash = this.generateBatchHash(batch)

    this.waitingBatches.set(hash, batch)
    this.waitingQueue.push({ ...batch, hash }, batch.scheduleAt)

    // 沿用现有调度逻辑
    this.schedule()
  }

  // 沿用现有RequestQueue的schedule逻辑
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

  // 沿用现有executeTask逻辑，但处理批次
  private async executeBatch(batch: BatchTask & { hash: string }) {
    let timeoutId: NodeJS.Timeout | null = null

    try {
      // 沿用现有超时逻辑
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Batch ${batch.id} timed out after ${this.options.timeoutMs}ms`))
        }, this.options.timeoutMs)
      })

      // 执行批次任务
      const results = await Promise.race([
        batch.thunk(),
        timeoutPromise,
      ])

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // 处理成功结果
      await this.handleBatchSuccess(batch, results)
      batch.resolve()
    }
    catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // 沿用现有重试逻辑
      if (batch.retryCount < this.options.maxRetries) {
        batch.retryCount++

        const backoffDelayMs = this.options.baseRetryDelayMs * (2 ** (batch.retryCount - 1))
        const jitter = Math.random() * 0.1 * backoffDelayMs
        const delayMs = backoffDelayMs + jitter

        batch.scheduleAt = Date.now() + delayMs

        // 重新入队
        this.waitingBatches.set(batch.hash, batch)
        this.waitingQueue.push(batch, batch.scheduleAt)
        this.schedule()
      }
      else {
        // 重试失败，将任务推送回任务队列
        await this.handleBatchFailure(batch, error as Error)
        batch.reject(error as Error)
      }
    }
    finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      this.executingBatches.delete(batch.hash)
      this.schedule()
    }
  }

  // 沿用现有refillTokens逻辑
  private refillTokens() {
    const now = Date.now()
    const timeSinceLastRefill = now - this.lastRefill
    const tokensToAdd = (timeSinceLastRefill / 1000) * this.options.rate
    this.bucketTokens = Math.min(this.bucketTokens + tokensToAdd, this.options.capacity)
    this.lastRefill = now
  }

  private async executeBatchTranslation(tasks: TranslationTask[]): Promise<string[]> {
    const { langConfig, providerConfig } = tasks[0]

    // AI 翻译使用批量 prompt
    if (this.isAITranslation(providerConfig)) {
      const targetLang = LANG_CODE_TO_EN_NAME[langConfig.targetCode] || langConfig.targetCode
      const inputs = tasks.map(task => task.text)

      const result = await this.executeBatchAITranslation(inputs, targetLang, langConfig, providerConfig)
      return result.split('%%').map(t => t.trim())
    }

    // 非 AI 翻译并发调用每个任务
    const translationPromises = tasks.map(task =>
      executeTranslate(task.text, task.langConfig, task.providerConfig),
    )

    return await Promise.all(translationPromises)
  }

  private async executeBatchAITranslation(
    inputs: string[],
    targetLang: string,
    langConfig: any,
    providerConfig: any,
  ): Promise<string> {
    const { aiTranslate } = await import('@/utils/host/translate/api/ai')
    return await aiTranslate(inputs.join('%%'), targetLang, providerConfig, { isBatch: true })
  }

  private isAITranslation(providerConfig: any): boolean {
    return isLLMTranslateProviderConfig(providerConfig)
  }

  private async handleBatchSuccess(batch: BatchTask, results: string[]): Promise<void> {
    if (results.length !== batch.tasks.length) {
      throw new Error(`Translation count mismatch: expected ${batch.tasks.length}, got ${results.length}`)
    }

    for (let i = 0; i < batch.tasks.length; i++) {
      const task = batch.tasks[i]
      const result = results[i]

      // 缓存结果
      await db.translationCache.put({
        key: task.hash,
        translation: result,
        createdAt: new Date(),
      })

      // 返回给调用者
      task.resolve(result)

      // 清理重试计数
      this.taskRetryCounter.delete(task.id)
    }
  }

  private async handleBatchFailure(batch: BatchTask, error: Error): Promise<void> {
    logger.error('Batch processing failed:', error)

    // 检查任务重试次数，决定是否推送回任务队列
    const retryableTasks: TranslationTask[] = []

    batch.tasks.forEach((task) => {
      const currentRetries = this.taskRetryCounter.get(task.id) || 0

      if (currentRetries < this.options.maxRetries) {
        this.taskRetryCounter.set(task.id, currentRetries + 1)
        // 延迟重试
        task.scheduleAt = Date.now() + (currentRetries + 1) * 1000
        retryableTasks.push(task)
      }
      else {
        // 超过重试次数，直接失败
        task.reject(new Error(`Task failed after ${this.options.maxRetries} retries: ${error.message}`))
        this.taskRetryCounter.delete(task.id)
      }
    })

    // 将可重试任务推送回任务队列
    if (retryableTasks.length > 0) {
      this.taskQueue.requeueTasks(retryableTasks)
    }
  }

  private generateBatchHash(batch: BatchTask): string {
    return `batch-${batch.id}`
  }

  // 配置更新
  setQueueOptions(options: Partial<BatchQueueOptions>) {
    this.options = deepmerge(this.options, options) as BatchQueueOptions
    if (options.capacity) {
      this.bucketTokens = options.capacity
      this.lastRefill = Date.now()
    }
  }

  setBatchConfig(config: Partial<BatchConfig>) {
    this.batchConfig = { ...this.batchConfig, ...config }
  }
}
