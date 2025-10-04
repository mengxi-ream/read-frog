import { batchQueueConfigSchema } from '@/types/config/translate'

const BASE_BACKOFF_DELAY_MS = 1000
const MAX_BACKOFF_DELAY_MS = 8000

interface BatchTask<T, R> {
  data: T
  resolve: (value: R) => void
  reject: (error: Error) => void
}

interface PendingBatch<T, R> {
  id: string
  tasks: BatchTask<T, R>[]
  totalCharacters: number
  createdAt: number
}

export interface BatchOptions<T, R> {
  maxCharactersPerBatch: number
  maxItemsPerBatch: number
  batchDelay: number
  maxRetries?: number
  enableFallbackToIndividual?: boolean
  getBatchKey: (data: T) => string
  getCharacters: (data: T) => number
  executeBatch: (dataList: T[]) => Promise<R[]>
  executeIndividual?: (data: T) => Promise<R>
  onError?: (error: Error, context: { batchKey: string, retryCount: number, isFallback: boolean }) => void
}

export class BatchQueue<T, R> {
  private pendingBatchMap = new Map<string, PendingBatch<T, R>>()
  private nextScheduleTimer: NodeJS.Timeout | null = null
  private maxCharactersPerBatch: number
  private maxItemsPerBatch: number
  private batchDelay: number
  private maxRetries: number
  private enableFallbackToIndividual: boolean
  private getBatchKey: (data: T) => string
  private getCharacters: (data: T) => number
  private executeBatch: (dataList: T[]) => Promise<R[]>
  private executeIndividual?: (data: T) => Promise<R>
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
    this.onError = config.onError
  }

  enqueue(data: T): Promise<R> {
    let resolve!: (value: R) => void
    let reject!: (error: Error) => void
    const promise = new Promise<R>((res, rej) => {
      resolve = res
      reject = rej
    })

    const batchKey = this.getBatchKey(data)
    const task: BatchTask<T, R> = { data, resolve, reject }

    this.addTaskToBatch(task, batchKey)
    this.schedule()

    return promise
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
    const batchId = crypto.randomUUID()

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

    const { tasks } = pendingBatch

    void this.executeBatchWithRetry(tasks, batchKey, 0)
  }

  private async executeBatchWithRetry(tasks: BatchTask<T, R>[], batchKey: string, retryCount: number): Promise<void> {
    try {
      const results = await this.executeBatch(tasks.map(task => task.data))

      if (!results) {
        throw new Error('Batch execution results are undefined')
      }

      if (results.length !== tasks.length) {
        throw new Error(`Batch result count mismatch: expected ${tasks.length}, got ${results.length}.\nResults: ["${results.join('",\n"')}"]`)
      }

      tasks.forEach((task, index) => task.resolve(results[index]))
    }
    catch (error) {
      const err = error as Error

      this.onError?.(err, { batchKey, retryCount, isFallback: false })

      if (retryCount < this.maxRetries) {
        const delay = this.calculateBackoffDelay(retryCount)
        await this.sleep(delay)
        return this.executeBatchWithRetry(tasks, batchKey, retryCount + 1)
      }

      if (this.enableFallbackToIndividual && this.executeIndividual) {
        return this.executeFallbackIndividual(tasks, batchKey)
      }

      tasks.forEach(task => task.reject(err))
    }
  }

  private async executeFallbackIndividual(tasks: BatchTask<T, R>[], batchKey: string) {
    await Promise.allSettled(
      tasks.map(async (task) => {
        try {
          if (!this.executeIndividual) {
            throw new Error('executeIndividual is not defined')
          }
          const result = await this.executeIndividual(task.data)
          task.resolve(result)
        }
        catch (error) {
          const err = error as Error
          this.onError?.(err, { batchKey, retryCount: this.maxRetries, isFallback: true })
          task.reject(err)
        }
      }),
    )
  }

  private calculateBackoffDelay(retryCount: number): number {
    return Math.min(BASE_BACKOFF_DELAY_MS * (2 ** retryCount), MAX_BACKOFF_DELAY_MS)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  setBatchConfig(config: Partial<Pick<BatchOptions<T, R>, 'maxCharactersPerBatch' | 'maxItemsPerBatch'>>) {
    const parseConfigStatus = batchQueueConfigSchema.partial().safeParse(config)
    if (parseConfigStatus.error) {
      throw new Error(parseConfigStatus.error.issues[0].message)
    }

    this.maxCharactersPerBatch = config.maxCharactersPerBatch ?? this.maxCharactersPerBatch
    this.maxItemsPerBatch = config.maxItemsPerBatch ?? this.maxItemsPerBatch
  }
}
