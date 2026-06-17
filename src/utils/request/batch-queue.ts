import { batchQueueConfigSchema } from "@/types/config/translate"
import { getRandomUUID } from "@/utils/crypto-polyfill"

export class BatchCountMismatchError extends Error {
  constructor(expected: number, got: number, results: unknown[]) {
    super(`Batch result count mismatch: expected ${expected}, got ${got}.\nResults: ["${results.join("\",\n\"")}"]`)
    this.name = "BatchCountMismatchError"
  }
}

const BASE_BACKOFF_DELAY_MS = 1000
const MAX_BACKOFF_DELAY_MS = 8000

interface BatchTask<T, R> {
  data: T
  resolve: (value: R) => void
  reject: (error: Error) => void
  cancelGroupId?: string
  executionCancelGroupId?: string
  drained: boolean
}

interface PendingBatch<T, R> {
  id: string
  tasks: BatchTask<T, R>[]
  totalCharacters: number
  createdAt: number
  executionCancelGroupId?: string
}

export interface BatchQueueExecutionContext {
  cancelGroupId?: string
}

export interface BatchOptions<T, R> {
  maxCharactersPerBatch: number
  maxItemsPerBatch: number
  batchDelay: number
  maxRetries?: number
  enableFallbackToIndividual?: boolean
  getBatchKey: (data: T) => string
  getCharacters: (data: T) => number
  executeBatch: (dataList: T[], context: BatchQueueExecutionContext) => Promise<R[]>
  executeIndividual?: (data: T, context: BatchQueueExecutionContext) => Promise<R>
  cancelExecution?: (context: BatchQueueExecutionContext) => void
  onError?: (error: Error, context: { batchKey: string, retryCount: number, isFallback: boolean }) => void
}

export interface BatchQueueEnqueueOptions {
  cancelGroupId?: string
}

export class BatchQueueCancelledError extends Error {
  constructor(cancelGroupId: string) {
    super(`Batch group cancelled: ${cancelGroupId}`)
    this.name = "BatchQueueCancelledError"
  }
}

export class BatchQueue<T, R> {
  private pendingBatchMap = new Map<string, PendingBatch<T, R>>()
  private executingBatchMap = new Map<string, PendingBatch<T, R>>()
  private nextScheduleTimer: NodeJS.Timeout | null = null
  private maxCharactersPerBatch: number
  private maxItemsPerBatch: number
  private batchDelay: number
  private maxRetries: number
  private enableFallbackToIndividual: boolean
  private getBatchKey: (data: T) => string
  private getCharacters: (data: T) => number
  private executeBatch: (dataList: T[], context: BatchQueueExecutionContext) => Promise<R[]>
  private executeIndividual?: (data: T, context: BatchQueueExecutionContext) => Promise<R>
  private cancelExecution?: (context: BatchQueueExecutionContext) => void
  private onError?: (error: Error, context: { batchKey: string, retryCount: number, isFallback: boolean }) => void

  constructor(config: BatchOptions<T, R>) {
    this.maxCharactersPerBatch = config.maxCharactersPerBatch
    this.maxItemsPerBatch = config.maxItemsPerBatch
    this.batchDelay = config.batchDelay
    this.maxRetries = config.maxRetries ?? 3
    this.enableFallbackToIndividual = config.enableFallbackToIndividual ?? true
    this.getBatchKey = config.getBatchKey
    this.getCharacters = config.getCharacters
    this.executeBatch = config.executeBatch
    this.executeIndividual = config.executeIndividual
    this.cancelExecution = config.cancelExecution
    this.onError = config.onError
  }

  enqueue(data: T, options: BatchQueueEnqueueOptions = {}): Promise<R> {
    let resolve!: (value: R) => void
    let reject!: (error: Error) => void
    const promise = new Promise<R>((res, rej) => {
      resolve = res
      reject = rej
    })

    const batchKey = this.getBatchKey(data)
    const task: BatchTask<T, R> = {
      data,
      resolve,
      reject,
      cancelGroupId: options.cancelGroupId,
      drained: false,
    }

    this.addTaskToBatch(task, batchKey)
    this.schedule()

    return promise
  }

  cancelGroup(cancelGroupId: string): void {
    const error = new BatchQueueCancelledError(cancelGroupId)

    for (const [batchKey, batch] of this.pendingBatchMap.entries()) {
      this.cancelTasksForGroup(batch, cancelGroupId, error)
      this.removeDrainedTasks(batch)
      if (batch.tasks.length === 0) {
        this.pendingBatchMap.delete(batchKey)
      }
    }

    for (const batch of this.executingBatchMap.values()) {
      this.cancelTasksForGroup(batch, cancelGroupId, error)
      if (!this.hasActiveTasks(batch)) {
        this.cancelBatchExecution(batch)
      }
    }

    this.schedule()
  }

  private schedule() {
    if (this.nextScheduleTimer) {
      clearTimeout(this.nextScheduleTimer)
      this.nextScheduleTimer = null
    }

    const now = Date.now()
    const batchesToFlush: string[] = []

    for (const [batchKey, batch] of this.pendingBatchMap.entries()) {
      const shouldFlushNow = this.shouldFlushBatch(batch)
      const isTimedOut = now >= batch.createdAt + this.batchDelay

      if (shouldFlushNow || isTimedOut) {
        batchesToFlush.push(batchKey)
      }
    }

    for (const batchKey of batchesToFlush) {
      this.flushPendingBatchByKey(batchKey)
    }

    if (this.pendingBatchMap.size > 0) {
      this.nextScheduleTimer = setTimeout(() => {
        this.nextScheduleTimer = null
        this.schedule()
      }, this.batchDelay)
    }
  }

  private addTaskToBatch(task: BatchTask<T, R>, batchKey: string) {
    const characters = this.getCharacters(task.data)
    const existingBatch = this.pendingBatchMap.get(batchKey)

    if (existingBatch) {
      if (existingBatch.totalCharacters + characters <= this.maxCharactersPerBatch) {
        existingBatch.tasks.push(task)
        existingBatch.totalCharacters += characters
      }
      else {
        this.flushPendingBatchByKey(batchKey)
        this.createNewPendingBatch(task, batchKey)
      }
    }
    else {
      this.createNewPendingBatch(task, batchKey)
    }
  }

  private shouldFlushBatch(batch: PendingBatch<T, R>): boolean {
    return (
      batch.tasks.length >= this.maxItemsPerBatch
      || batch.totalCharacters >= this.maxCharactersPerBatch
    )
  }

  private createNewPendingBatch(task: BatchTask<T, R>, batchKey: string) {
    const batchId = getRandomUUID()

    const pendingBatch: PendingBatch<T, R> = {
      id: batchId,
      tasks: [task],
      totalCharacters: this.getCharacters(task.data),
      createdAt: Date.now(),
    }

    this.pendingBatchMap.set(batchKey, pendingBatch)
  }

  private flushPendingBatchByKey(batchKey: string) {
    const pendingBatch = this.pendingBatchMap.get(batchKey)
    if (!pendingBatch)
      return

    this.pendingBatchMap.delete(batchKey)

    if (pendingBatch.tasks.length === 0)
      return

    this.executingBatchMap.set(pendingBatch.id, pendingBatch)

    void this.executeBatchWithRetry(pendingBatch, batchKey, 0)
  }

  private async executeBatchWithRetry(batch: PendingBatch<T, R>, batchKey: string, retryCount: number): Promise<void> {
    this.removeDrainedTasks(batch)

    if (!this.hasActiveTasks(batch)) {
      this.executingBatchMap.delete(batch.id)
      return
    }

    const tasks = [...batch.tasks]

    try {
      const context = this.getBatchExecutionContext(batch)
      const results = await this.executeBatch(tasks.map(task => task.data), context)

      if (!this.hasActiveTasks(batch)) {
        this.executingBatchMap.delete(batch.id)
        return
      }

      if (!results) {
        throw new Error("Batch execution results are undefined")
      }

      if (results.length !== tasks.length) {
        throw new BatchCountMismatchError(tasks.length, results.length, results)
      }

      tasks.forEach((task, index) => this.resolveTask(task, results[index]))
      this.executingBatchMap.delete(batch.id)
    }
    catch (error) {
      const err = error as Error
      this.removeDrainedTasks(batch)

      if (!this.hasActiveTasks(batch)) {
        this.executingBatchMap.delete(batch.id)
        return
      }

      this.onError?.(err, { batchKey, retryCount, isFallback: false })

      // Only retry on count mismatch errors (LLM returned wrong number of results)
      if (retryCount < this.maxRetries && err instanceof BatchCountMismatchError) {
        const delay = this.calculateBackoffDelay(retryCount)
        await this.sleep(delay)
        return this.executeBatchWithRetry(batch, batchKey, retryCount + 1)
      }

      if (this.enableFallbackToIndividual && this.executeIndividual && err instanceof BatchCountMismatchError) {
        return this.executeFallbackIndividual(batch, batchKey)
      }

      batch.tasks.forEach(task => this.rejectTask(task, err))
      this.executingBatchMap.delete(batch.id)
    }
  }

  private async executeFallbackIndividual(batch: PendingBatch<T, R>, batchKey: string) {
    await Promise.allSettled(
      batch.tasks.map(async (task) => {
        try {
          if (task.drained) {
            return
          }
          if (!this.executeIndividual) {
            throw new Error("executeIndividual is not defined")
          }
          const context = this.createTaskExecutionContext(task)
          const result = await this.executeIndividual(task.data, context)
          this.resolveTask(task, result)
          task.executionCancelGroupId = undefined
        }
        catch (error) {
          const err = error as Error
          this.onError?.(err, { batchKey, retryCount: this.maxRetries, isFallback: true })
          this.rejectTask(task, err)
          task.executionCancelGroupId = undefined
        }
      }),
    )
    this.executingBatchMap.delete(batch.id)
  }

  private calculateBackoffDelay(retryCount: number): number {
    return Math.min(BASE_BACKOFF_DELAY_MS * (2 ** retryCount), MAX_BACKOFF_DELAY_MS)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private createTaskExecutionContext(task: BatchTask<T, R>): BatchQueueExecutionContext {
    if (!task.cancelGroupId) {
      return {}
    }

    task.executionCancelGroupId = getRandomUUID()
    return { cancelGroupId: task.executionCancelGroupId }
  }

  private getBatchExecutionContext(batch: PendingBatch<T, R>): BatchQueueExecutionContext {
    if (!batch.tasks.some(task => task.cancelGroupId)) {
      return {}
    }

    batch.executionCancelGroupId ??= getRandomUUID()
    return { cancelGroupId: batch.executionCancelGroupId }
  }

  private cancelTasksForGroup(batch: PendingBatch<T, R>, cancelGroupId: string, error: Error) {
    for (const task of batch.tasks) {
      if (task.cancelGroupId === cancelGroupId) {
        this.rejectTask(task, error)
        this.cancelTaskExecution(task)
      }
    }
  }

  private hasActiveTasks(batch: PendingBatch<T, R>): boolean {
    return batch.tasks.some(task => !task.drained)
  }

  private removeDrainedTasks(batch: PendingBatch<T, R>) {
    batch.tasks = batch.tasks.filter(task => !task.drained)
    batch.totalCharacters = batch.tasks.reduce((total, task) => total + this.getCharacters(task.data), 0)
  }

  private resolveTask(task: BatchTask<T, R>, value: R) {
    if (task.drained) {
      return
    }
    task.drained = true
    task.resolve(value)
  }

  private rejectTask(task: BatchTask<T, R>, error: Error) {
    if (task.drained) {
      return
    }
    task.drained = true
    task.reject(error)
  }

  private cancelBatchExecution(batch: PendingBatch<T, R>) {
    if (!batch.executionCancelGroupId) {
      return
    }

    this.cancelExecution?.({ cancelGroupId: batch.executionCancelGroupId })
    batch.executionCancelGroupId = undefined
  }

  private cancelTaskExecution(task: BatchTask<T, R>) {
    if (!task.executionCancelGroupId) {
      return
    }

    this.cancelExecution?.({ cancelGroupId: task.executionCancelGroupId })
    task.executionCancelGroupId = undefined
  }

  setBatchConfig(config: Partial<Pick<BatchOptions<T, R>, "maxCharactersPerBatch" | "maxItemsPerBatch">>) {
    const parseConfigStatus = batchQueueConfigSchema.partial().safeParse(config)
    if (parseConfigStatus.error) {
      throw new Error(parseConfigStatus.error.issues[0].message)
    }

    this.maxCharactersPerBatch = config.maxCharactersPerBatch ?? this.maxCharactersPerBatch
    this.maxItemsPerBatch = config.maxItemsPerBatch ?? this.maxItemsPerBatch
  }
}
