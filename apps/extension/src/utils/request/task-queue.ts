import type { BatchQueue } from './batch-queue'
import type { BatchConfig, BatchTask } from './batch-types'
import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { BinaryHeapPQ } from './priority-queue'

export interface TranslationTask {
  id: string
  text: string
  hash: string
  langConfig: Config['language']
  providerConfig: ProviderConfig
  scheduleAt: number
  createdAt: number
  resolve: (value: string) => void
  reject: (error: Error) => void
  promise: Promise<string>
}

interface PendingBatch {
  id: string
  tasks: TranslationTask[]
  characters: number
  langConfig: Config['language']
  providerConfig: ProviderConfig
  timer: NodeJS.Timeout
  createdAt: number
}

export class TaskQueue {
  private waitingQueue: BinaryHeapPQ<TranslationTask & { hash: string }>
  private waitingTasks = new Map<string, TranslationTask>()
  private nextScheduleTimer: NodeJS.Timeout | null = null
  private batchQueue: BatchQueue | null = null
  private batchConfig: BatchConfig
  private pendingBatchMap = new Map<string, PendingBatch>()

  constructor(batchConfig: BatchConfig) {
    this.waitingQueue = new BinaryHeapPQ<TranslationTask & { hash: string }>()
    this.batchConfig = batchConfig
  }

  setBatchQueue(batchQueue: BatchQueue): void {
    this.batchQueue = batchQueue
  }

  enqueue(task: TranslationTask): Promise<string> {
    const duplicateTask = this.duplicateTask(task.hash)
    if (duplicateTask) {
      return duplicateTask.promise
    }

    this.waitingTasks.set(task.hash, task)
    this.waitingQueue.push({ ...task, hash: task.hash }, task.scheduleAt)

    this.schedule()

    return task.promise
  }

  peek(): TranslationTask | undefined {
    return this.waitingQueue.peek()
  }

  dequeue(): TranslationTask | undefined {
    const task = this.waitingQueue.pop()
    if (task) {
      this.waitingTasks.delete(task.hash)
      return task
    }
    return undefined
  }

  requeue(task: TranslationTask): void {
    if (!this.waitingTasks.has(task.hash)) {
      this.waitingTasks.set(task.hash, task)
      this.waitingQueue.push({ ...task, hash: task.hash }, task.scheduleAt)
      this.schedule()
    }
  }

  requeueTasks(tasks: TranslationTask[]): void {
    tasks.forEach(task => this.requeue(task))
  }

  isEmpty(): boolean {
    return this.waitingQueue.isEmpty()
  }

  size(): number {
    return this.waitingQueue.size()
  }

  private schedule() {
    if (!this.batchQueue) {
      throw new Error('Batch queue is not set')
    }

    if (this.nextScheduleTimer) {
      clearTimeout(this.nextScheduleTimer)
      this.nextScheduleTimer = null
    }

    const readyTasks = this.collectReadyTasks()

    for (const task of readyTasks) {
      this.assignTaskToPendingBatch(task)
    }

    this.scheduleNext()
  }

  private collectReadyTasks(): TranslationTask[] {
    const readyTasks: TranslationTask[] = []
    const now = Date.now()

    while (!this.isEmpty()) {
      const task = this.peek()
      if (task && task.scheduleAt <= now) {
        const dequeuedTask = this.dequeue()
        if (dequeuedTask) {
          readyTasks.push(dequeuedTask)
        }
      }
      else {
        break
      }
    }

    return readyTasks
  }

  private scheduleNext() {
    if (this.isEmpty()) {
      return
    }

    const nextTask = this.peek()
    if (nextTask) {
      const delay = Math.max(0, nextTask.scheduleAt - Date.now())
      this.nextScheduleTimer = setTimeout(() => {
        this.schedule()
      }, delay)
    }
  }

  private assignTaskToPendingBatch(task: TranslationTask) {
    const configKey = this.getConfigKey(task)
    const taskCharacters = task.text.length

    // if task is too large, send directly
    if (taskCharacters > this.batchConfig.maxCharacters) {
      const batch = this.createSingleTaskBatch(task)
      this.batchQueue!.enqueue(batch)
      return
    }

    // if task is not ai translation, send directly
    if (!isLLMTranslateProviderConfig(task.providerConfig)) {
      const batch = this.createSingleTaskBatch(task)
      this.batchQueue!.enqueue(batch)
      return
    }

    const existingBatch = this.pendingBatchMap.get(configKey)

    if (existingBatch) {
      if (existingBatch.characters + taskCharacters <= this.batchConfig.maxCharacters) {
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
  }

  private shouldFlushBatch(batch: PendingBatch): boolean {
    return (
      batch.tasks.length >= this.batchConfig.minBatchSize
      || batch.characters >= this.batchConfig.maxCharacters
    )
  }

  private createNewPendingBatch(task: TranslationTask, configKey: string) {
    const batchId = crypto.randomUUID()

    const timer = setTimeout(() => {
      this.flushPendingBatchByKey(configKey)
    }, this.batchConfig.maxDelay)

    const pendingBatch: PendingBatch = {
      id: batchId,
      tasks: [task],
      characters: task.text.length,
      langConfig: task.langConfig,
      providerConfig: task.providerConfig,
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

    const batchTask = this.createBatchTask(pendingBatch.tasks)
    this.batchQueue!.enqueue(batchTask)
  }

  private getConfigKey(task: TranslationTask): string {
    return `${task.langConfig.sourceCode}-${task.langConfig.targetCode}-${task.providerConfig.id}`
  }

  private buildBatchTask(tasks: TranslationTask[]): BatchTask {
    return {
      id: crypto.randomUUID(),
      tasks,
      totalCharacters: tasks.reduce((sum, t) => sum + t.text.length, 0),
      langConfig: tasks[0].langConfig,
      providerConfig: tasks[0].providerConfig,
      scheduleAt: Date.now(),
      createdAt: Date.now(),
      retryCount: 0,
    }
  }

  private createBatchTask(tasks: TranslationTask[]): BatchTask {
    return this.buildBatchTask(tasks)
  }

  private createSingleTaskBatch(task: TranslationTask): BatchTask {
    return this.buildBatchTask([task])
  }

  private duplicateTask(hash: string): TranslationTask | undefined {
    return this.waitingTasks.get(hash)
  }
}
