import { BinaryHeapPQ } from './priority-queue'

export interface RequestTask {
  id: string
  thunk: () => Promise<any>
  promise: Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  scheduleAt: number
  createdAt: number
}

export interface QueueOptions {
  rate: number // tokens/sec
  capacity: number // token bucket size
  timeoutMs: number
  maxRetries: number
  baseRetryDelayMs: number
}

export class RequestQueue {
  private waitingQueue: BinaryHeapPQ<RequestTask & { hash: string }>
  private waitingTasks = new Map<string, RequestTask>()
  private executingTasks = new Map<string, RequestTask>()
  private nextScheduleTimer: NodeJS.Timeout | null = null

  // token bucket
  private bucketTokens: number
  private lastRefill: number

  constructor(private options: QueueOptions) {
    this.options = options
    this.bucketTokens = options.capacity
    this.lastRefill = Date.now()
    this.waitingQueue = new BinaryHeapPQ<RequestTask & { hash: string }>()
  }

  enqueue<T>(thunk: () => Promise<T>, scheduleAt: number, hash: string): Promise<T> {
    const duplicateTask = this.duplicateTask(hash)
    if (duplicateTask) {
      return duplicateTask.promise
    }

    let resolve!: (value: T) => void
    let reject!: (error: Error) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    const task: RequestTask = {
      id: crypto.randomUUID(),
      thunk,
      promise,
      resolve,
      reject,
      scheduleAt,
      createdAt: Date.now(),
    }

    this.waitingTasks.set(hash, task)
    this.waitingQueue.push({ ...task, hash }, scheduleAt)
    this.schedule()
    return promise
  }

  private schedule() {
    this.refillTokens()

    while (this.bucketTokens > 0 && this.waitingQueue.size() > 0) {
      const task = this.waitingQueue.pop()
      if (task && task.scheduleAt <= Date.now()) {
        this.waitingTasks.delete(task.hash)
        this.executingTasks.set(task.hash, task)
        this.bucketTokens--
        this.executeTask(task)
      }
    }

    if (this.waitingQueue.size() > 0 && this.nextScheduleTimer === null) {
      const msUntilNextToken = this.bucketTokens >= 1 ? 0 : Math.ceil((1 - this.bucketTokens) / this.options.rate) * 1000
      this.nextScheduleTimer = setTimeout(() => {
        this.schedule()
      }, msUntilNextToken)
    }
  }

  private async executeTask(task: RequestTask & { hash: string }) {
    try {
      const result = await task.thunk()
      task.resolve(result)
    }
    catch (error) {
      task.reject(error)
    }
    finally {
      this.executingTasks.delete(task.hash)
      this.schedule()
    }
  }

  private duplicateTask(hash: string) {
    const duplicateTask = this.waitingTasks.get(hash) ?? this.executingTasks.get(hash)
    if (duplicateTask) {
      return duplicateTask
    }
    return undefined
  }

  private refillTokens() {
    const now = Date.now()
    const timeSinceLastRefill = now - this.lastRefill
    const tokensToAdd = (timeSinceLastRefill / 1000) * this.options.rate
    this.bucketTokens = Math.min(this.bucketTokens + tokensToAdd, this.options.capacity)
    this.lastRefill = now
  }
}
