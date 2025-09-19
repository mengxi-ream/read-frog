import type { BatchConfig, BatchTask } from './batch-types'
import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
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
  private batchQueue: any = null // 避免循环依赖，使用any类型
  private batchConfig: BatchConfig
  private pendingBatchMap = new Map<string, PendingBatch>() // 按 configKey 索引的待处理批次

  constructor(batchConfig: BatchConfig) {
    this.waitingQueue = new BinaryHeapPQ<TranslationTask & { hash: string }>()
    this.batchConfig = batchConfig
  }

  setBatchQueue(batchQueue: any): void {
    this.batchQueue = batchQueue
  }

  enqueue(task: TranslationTask): Promise<string> {
    const duplicateTask = this.duplicateTask(task.hash)
    if (duplicateTask) {
      return duplicateTask.promise
    }

    this.waitingTasks.set(task.hash, task)
    this.waitingQueue.push({ ...task, hash: task.hash }, task.scheduleAt)

    // 启动调度
    this.schedule()

    return task.promise
  }

  // 标准队列接口：查看队首任务但不移除
  peek(): TranslationTask | undefined {
    return this.waitingQueue.peek()
  }

  // 标准队列接口：移除并返回队首任务
  dequeue(): TranslationTask | undefined {
    const task = this.waitingQueue.pop()
    if (task) {
      this.waitingTasks.delete(task.hash)
      return task
    }
    return undefined
  }

  // 重新入队（失败任务回流）
  requeue(task: TranslationTask): void {
    // 如果已存在相同hash任务，跳过
    if (!this.waitingTasks.has(task.hash)) {
      this.waitingTasks.set(task.hash, task)
      this.waitingQueue.push({ ...task, hash: task.hash }, task.scheduleAt)
      this.schedule()
    }
  }

  // 批量重新入队
  requeueTasks(tasks: TranslationTask[]): void {
    tasks.forEach(task => this.requeue(task))
  }

  // 检查队列是否为空
  isEmpty(): boolean {
    return this.waitingQueue.isEmpty()
  }

  // 获取队列大小
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

    // 收集所有就绪的任务
    const readyTasks = this.collectReadyTasks()

    // 将就绪任务分配到合适的待处理批次
    for (const task of readyTasks) {
      this.assignTaskToPendingBatch(task)
    }

    // 设置下次调度时间
    this.scheduleNext()
  }

  private collectReadyTasks(): TranslationTask[] {
    const readyTasks: TranslationTask[] = []
    const now = Date.now()

    // 从优先队列中收集所有已到时间的任务
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

    // 如果任务过大，直接发送
    if (taskCharacters > this.batchConfig.maxCharacters) {
      const batch = this.createSingleTaskBatch(task)
      this.batchQueue.enqueue(batch)
      return
    }

    // 检查是否已有该配置的待处理批次
    const existingBatch = this.pendingBatchMap.get(configKey)

    if (existingBatch) {
      // 检查是否能容纳新任务
      if (existingBatch.characters + taskCharacters <= this.batchConfig.maxCharacters) {
        // 可以添加到现有批次
        existingBatch.tasks.push(task)
        existingBatch.characters += taskCharacters

        // 检查是否达到推送条件
        if (this.shouldFlushBatch(existingBatch)) {
          this.flushPendingBatchByKey(configKey)
        }
      }
      else {
        // 当前批次已满，先推送现有批次，然后创建新批次
        this.flushPendingBatchByKey(configKey)
        this.createNewPendingBatch(task, configKey)
      }
    }
    else {
      // 创建新的待处理批次
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

    // 创建超时定时器
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

    // 检查新创建的批次是否立即需要推送
    if (this.shouldFlushBatch(pendingBatch)) {
      this.flushPendingBatchByKey(configKey)
    }
  }

  private flushPendingBatchByKey(configKey: string) {
    const pendingBatch = this.pendingBatchMap.get(configKey)
    if (!pendingBatch)
      return

    // 移除批次
    this.pendingBatchMap.delete(configKey)
    clearTimeout(pendingBatch.timer)

    // 创建并发送批次任务
    const batchTask = this.createBatchTask(pendingBatch.tasks)
    this.batchQueue.enqueue(batchTask)
  }

  private getConfigKey(task: TranslationTask): string {
    return `${task.langConfig.sourceCode}-${task.langConfig.targetCode}-${task.providerConfig.id}`
  }

  private createBatchTask(tasks: TranslationTask[]): BatchTask {
    let resolve!: (value: void) => void
    let reject!: (error: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })

    return {
      id: crypto.randomUUID(),
      tasks,
      totalCharacters: tasks.reduce((sum, t) => sum + t.text.length, 0),
      langConfig: tasks[0].langConfig,
      providerConfig: tasks[0].providerConfig,
      scheduleAt: Date.now(),
      createdAt: Date.now(),
      retryCount: 0,
      thunk: () => Promise.resolve([]), // 占位符，实际执行在BatchQueue中
      promise,
      resolve,
      reject,
    }
  }

  private createSingleTaskBatch(task: TranslationTask): BatchTask {
    let resolve!: (value: void) => void
    let reject!: (error: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })

    return {
      id: crypto.randomUUID(),
      tasks: [task],
      totalCharacters: task.text.length,
      langConfig: task.langConfig,
      providerConfig: task.providerConfig,
      scheduleAt: Date.now(),
      createdAt: Date.now(),
      retryCount: 0,
      thunk: () => Promise.resolve([]), // 占位符，实际执行在BatchQueue中
      promise,
      resolve,
      reject,
    }
  }

  private duplicateTask(hash: string): TranslationTask | undefined {
    return this.waitingTasks.get(hash)
  }
}
