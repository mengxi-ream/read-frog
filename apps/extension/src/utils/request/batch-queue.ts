import type { RequestQueue } from './request-queue'
import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { requestBatchConfigSchema } from '@/types/config/translate'
import { BATCH_SEPARATOR } from '@/utils/constants/prompt'
import { executeTranslate } from '@/utils/host/translate/translate-text'
import { Sha256Hex } from '../hash'

interface BatchTask {
  text: string
  langConfig: Config['language']
  providerConfig: ProviderConfig
  scheduleAt: number
  hash: string
  resolve: (value: string) => void
  reject: (error: Error) => void
}

interface PendingBatch {
  id: string
  tasks: BatchTask[]
  characters: number
  timer: ReturnType<typeof setTimeout>
  createdAt: number
}

export interface BatchOptions {
  batchCharacters: number
  batchSize: number
  batchDelay: number
}

export class BatchQueue {
  private requestQueue: RequestQueue | null = null
  private pendingBatchMap = new Map<string, PendingBatch>()
  private batchCharacters: number
  private batchSize: number
  private batchDelay: number

  constructor(config: BatchOptions) {
    this.batchCharacters = config.batchCharacters
    this.batchSize = config.batchSize
    this.batchDelay = config.batchDelay
  }

  enqueue(text: string, langConfig: Config['language'], providerConfig: ProviderConfig, scheduleAt: number, hash: string): Promise<string> {
    if (!this.requestQueue) {
      throw new Error('Request queue is not set. Call setRequestQueue() first.')
    }

    let resolve!: (value: string) => void
    let reject!: (error: Error) => void
    const promise = new Promise<string>((res, rej) => {
      resolve = res
      reject = rej
    })

    const configKey = this.getConfigKey(langConfig, providerConfig)
    const taskCharacters = text.length

    const existingBatch = this.pendingBatchMap.get(configKey)
    const task = { text, langConfig, providerConfig, scheduleAt, hash, resolve, reject }

    if (existingBatch) {
      if (existingBatch.characters + taskCharacters <= this.batchCharacters) {
        existingBatch.tasks.push(task)
        existingBatch.characters += taskCharacters
        if (this.shouldFlushBatch(existingBatch)) {
          this.flushPendingBatchByKey(configKey)
        }
      }
      else {
        this.flushPendingBatchByKey(configKey)
        this.createNewPendingBatch(task, configKey)
      }
    }
    else {
      this.createNewPendingBatch(task, configKey)
    }

    return promise
  }

  private shouldFlushBatch(batch: PendingBatch): boolean {
    return (
      batch.tasks.length >= this.batchSize
      || batch.characters >= this.batchCharacters
    )
  }

  private createNewPendingBatch(task: BatchTask, configKey: string) {
    const batchId = crypto.randomUUID()

    const timer = setTimeout(() => {
      this.flushPendingBatchByKey(configKey)
    }, this.batchDelay)

    const pendingBatch: PendingBatch = {
      id: batchId,
      tasks: [task],
      characters: task.text.length,
      timer,
      createdAt: Date.now(),
    }

    this.pendingBatchMap.set(configKey, pendingBatch)

    if (this.shouldFlushBatch(pendingBatch)) {
      this.flushPendingBatchByKey(configKey)
    }
  }

  private flushPendingBatchByKey(configKey: string) {
    const pendingBatch = this.pendingBatchMap.get(configKey)
    if (!pendingBatch)
      return

    this.pendingBatchMap.delete(configKey)
    clearTimeout(pendingBatch.timer)

    const { tasks } = pendingBatch
    const hash = Sha256Hex(...tasks.map(task => task.hash))

    const batchThunk = async (): Promise<string[]> => {
      const { langConfig, providerConfig } = tasks[0]
      const inputs = tasks.map(task => task.text)
      const text = inputs.join(BATCH_SEPARATOR)
      const result = await executeTranslate(text, langConfig, providerConfig, { isBatch: true })
      const results = result.split(BATCH_SEPARATOR).map(t => t.trim())

      if (!results) {
        throw new Error('Translation results are undefined')
      }

      if (results.length !== tasks.length) {
        throw new Error(`Translation count mismatch: expected ${tasks.length}, got ${results.length}`)
      }

      return results
    }

    this.requestQueue!.enqueue(batchThunk, Date.now(), hash).then((results) => {
      tasks.forEach((task, index) => task.resolve(results[index]))
    }).catch((error) => {
      tasks.forEach(task => task.reject(error as Error))
    })
  }

  private getConfigKey(langConfig: Config['language'], providerConfig: ProviderConfig): string {
    return `${langConfig.sourceCode}-${langConfig.targetCode}-${providerConfig.id}`
  }

  setRequestQueue(requestQueue: RequestQueue): void {
    this.requestQueue = requestQueue
  }

  setBatchConfig(config: Partial<BatchOptions>) {
    const parseConfigStatus = requestBatchConfigSchema.partial().safeParse(config)
    if (parseConfigStatus.error) {
      throw new Error(parseConfigStatus.error.issues[0].message)
    }
    this.batchCharacters = config.batchCharacters ?? this.batchCharacters
    this.batchSize = config.batchSize ?? this.batchSize
  }
}
