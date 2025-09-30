import { batchQueueConfigSchema } from '@/types/config/translate'

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
  getBatchKey: (data: T) => string
  getCharacters: (data: T) => number
  executeBatch: (dataList: T[]) => Promise<R[]>
}

export class BatchQueue<T, R> {
  private pendingBatchMap = new Map<string, PendingBatch<T, R>>()
  private nextScheduleTimer: NodeJS.Timeout | null = null
  private maxCharactersPerBatch: number
  private maxItemsPerBatch: number
  private batchDelay: number
  private getBatchKey: (data: T) => string
  private getCharacters: (data: T) => number
  private executeBatch: (dataList: T[]) => Promise<R[]>

  constructor(config: BatchOptions<T, R>) {
    this.maxCharactersPerBatch = config.maxCharactersPerBatch
    this.maxItemsPerBatch = config.maxItemsPerBatch
    this.batchDelay = config.batchDelay
    this.getBatchKey = config.getBatchKey
    this.getCharacters = config.getCharacters
    this.executeBatch = config.executeBatch
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

    this.executeBatch(tasks.map(task => task.data)).then((results) => {
      if (!results) {
        throw new Error('Batch execution results are undefined')
      }

      if (results.length !== tasks.length) {
        throw new Error(`Batch result count mismatch: expected ${tasks.length}, got ${results.length}`)
      }

      tasks.forEach((task, index) => task.resolve(results[index]))
    }).catch((error) => {
      tasks.forEach(task => task.reject(error as Error))
    })
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
