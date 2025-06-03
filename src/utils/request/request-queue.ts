import { BinaryHeapPQ } from './priority-queue'

export interface RequestTask {
  id: string
  thunk: () => Promise<any>
  promise: Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  scheduleAt: number
  createdAt: number
  retryCount: number
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
      // console.info(`🔄 Found duplicate task for hash: ${hash}, returning existing promise`)
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
      retryCount: 0,
    }

    this.waitingTasks.set(hash, task)
    this.waitingQueue.push({ ...task, hash }, scheduleAt)

    // console.info(`✅ Task ${task.id} added to queue. Queue size: ${this.waitingQueue.size()}, waiting: ${this.waitingTasks.size}, executing: ${this.executingTasks.size}`)

    this.schedule()
    return promise
  }

  private schedule() {
    this.refillTokens()

    while (this.bucketTokens >= 1 && this.waitingQueue.size() > 0) {
      const task = this.waitingQueue.peek()
      if (task && task.scheduleAt <= Date.now()) {
        this.waitingQueue.pop()
        this.waitingTasks.delete(task.hash)
        this.executingTasks.set(task.hash, task)
        this.bucketTokens--
        this.executeTask(task)
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
      const nextTask = this.waitingQueue.peek()
      if (nextTask) {
        const now = Date.now()
        const delayUntilScheduled = Math.max(0, nextTask.scheduleAt - now)
        const msUntilNextToken = this.bucketTokens >= 1 ? 0 : Math.ceil((1 - this.bucketTokens) / this.options.rate * 1000)
        const delay = Math.max(delayUntilScheduled, msUntilNextToken)

        this.nextScheduleTimer = setTimeout(() => {
          this.nextScheduleTimer = null
          this.schedule()
        }, delay)
      }
    }
  }

  private async executeTask(task: RequestTask & { hash: string }) {
    // console.info(`🏃 Starting execution of task ${task.id} (attempt ${task.retryCount + 1}) at ${Date.now()}`)

    let timeoutId: NodeJS.Timeout | null = null

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          // console.info(`⏰ Task ${task.id} timed out after ${this.options.timeoutMs}ms`)
          reject(new Error(`Task ${task.id} timed out after ${this.options.timeoutMs}ms`))
        }, this.options.timeoutMs)
      })

      // Race between the actual task and timeout
      const result = await Promise.race([
        task.thunk(),
        timeoutPromise,
      ])

      // Clear timeout if task completed successfully
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // console.info(`✅ Task ${task.id} completed successfully at ${Date.now()}`)
      task.resolve(result)
    }
    catch (error) {
      // Clear timeout if it hasn't fired yet
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // console.error(`❌ Task ${task.id} failed at ${Date.now()}:`, error)

      // Check if we should retry
      if (task.retryCount < this.options.maxRetries) {
        task.retryCount++

        // Calculate exponential backoff delay
        const backoffDelayMs = this.options.baseRetryDelayMs * (2 ** (task.retryCount - 1))

        // Add some jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * backoffDelayMs
        const delayMs = backoffDelayMs + jitter

        // Schedule retry
        const retryAt = Date.now() + delayMs
        task.scheduleAt = retryAt

        // console.warn(`🔄 Retrying task ${task.id} (attempt ${task.retryCount}/${this.options.maxRetries}) after ${Math.round(delayMs)}ms`)

        // Move task back to waiting queue for retry
        this.waitingTasks.set(task.hash, task)
        this.waitingQueue.push(task, retryAt)
        this.schedule()
      }
      else {
        // Max retries exceeded, reject the promise
        // console.error(`💀 Task ${task.id} failed permanently after ${this.options.maxRetries} retries`)
        task.reject(error)
      }
    }
    finally {
      // Ensure timeout is always cleared
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

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
    // const oldTokens = this.bucketTokens
    this.bucketTokens = Math.min(this.bucketTokens + tokensToAdd, this.options.capacity)

    // if (tokensToAdd > 0.01) { // Only log if meaningful tokens were added
    //   console.log(`🪣 Token bucket refilled: ${oldTokens.toFixed(2)} -> ${this.bucketTokens.toFixed(2)} (+${tokensToAdd.toFixed(2)}) after ${timeSinceLastRefill}ms`)
    // }

    this.lastRefill = now
  }
}
