import type { RequestRetryPolicy } from "./retry-policy"
import { deepmerge } from "deepmerge-ts"
import { requestQueueConfigSchema } from "@/types/config/translate"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { BinaryHeapPQ } from "./priority-queue"
import { defaultRequestRetryPolicy } from "./retry-policy"

export interface RequestTask {
  id: string
  thunk: () => Promise<any>
  promise: Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  scheduleAt: number
  createdAt: number
  retryCount: number
  drained: boolean
}

type QueuedRequestTask = RequestTask & { hash: string }

export interface QueueOptions {
  rate: number // tokens/sec
  capacity: number // token bucket size
  timeoutMs: number
  maxRetries: number
  baseRetryDelayMs: number
  retryPolicy?: RequestRetryPolicy
}

export class RequestQueue {
  private waitingQueue: BinaryHeapPQ<QueuedRequestTask>
  private waitingTasks = new Map<string, QueuedRequestTask>()
  private executingTasks = new Map<string, QueuedRequestTask>()
  private nextScheduleTimer: NodeJS.Timeout | null = null
  private retryPolicy: RequestRetryPolicy

  // token bucket
  private bucketTokens: number
  private lastRefill: number

  constructor(private options: QueueOptions) {
    this.options = options
    this.retryPolicy = options.retryPolicy ?? defaultRequestRetryPolicy
    this.bucketTokens = options.capacity
    this.lastRefill = Date.now()
    this.waitingQueue = new BinaryHeapPQ<QueuedRequestTask>()
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

    const task: QueuedRequestTask = {
      id: getRandomUUID(),
      hash,
      thunk,
      promise,
      resolve,
      reject,
      scheduleAt,
      createdAt: Date.now(),
      retryCount: 0,
      drained: false,
    }

    this.waitingTasks.set(hash, task)
    this.waitingQueue.push(task, scheduleAt)

    // console.info(`✅ Task ${task.id} added to queue. Queue size: ${this.waitingQueue.size()}, waiting: ${this.waitingTasks.size}, executing: ${this.executingTasks.size}`)

    this.schedule()
    return promise
  }

  setQueueOptions(options: Partial<QueueOptions>) {
    const { retryPolicy, ...queueOptions } = options
    const parseConfigStatus = requestQueueConfigSchema.partial().safeParse(queueOptions)
    if (parseConfigStatus.error) {
      throw new Error(parseConfigStatus.error.issues[0].message)
    }
    this.options = deepmerge(this.options, queueOptions) as QueueOptions
    if (retryPolicy) {
      this.retryPolicy = retryPolicy
    }
    if (queueOptions.capacity) {
      this.bucketTokens = queueOptions.capacity
      this.lastRefill = Date.now()
    }
  }

  private schedule() {
    this.refillTokens()

    while (this.bucketTokens >= 1 && this.waitingQueue.size() > 0) {
      const now = Date.now()

      const task = this.waitingQueue.peek()
      if (task && task.scheduleAt <= now) {
        this.waitingQueue.pop()
        this.waitingTasks.delete(task.hash)
        this.executingTasks.set(task.hash, task)
        this.bucketTokens--
        void this.executeTask(task)
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

  private async executeTask(task: QueuedRequestTask) {
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
      if (!task.drained) {
        task.resolve(result)
      }
    }
    catch (error) {
      // Clear timeout if it hasn't fired yet
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // console.error(`❌ Task ${task.id} failed at ${Date.now()}:`, error)

      if (task.drained) {
        return
      }

      const now = Date.now()
      const decision = this.retryPolicy.decide(error, {
        retryCount: task.retryCount,
        maxRetries: this.options.maxRetries,
        baseRetryDelayMs: this.options.baseRetryDelayMs,
        now,
      })

      // Check if we should retry
      if (decision.action === "retry") {
        task.retryCount++
        // Schedule retry
        const retryAt = now + decision.delayMs
        task.scheduleAt = retryAt

        // console.warn(`🔄 Retrying task ${task.id} (attempt ${task.retryCount}/${this.options.maxRetries}) after ${Math.round(decision.delayMs)}ms`)

        // Move task back to waiting queue for retry
        this.waitingTasks.set(task.hash, task)
        this.waitingQueue.push(task, retryAt)
        this.schedule()
      }
      else {
        // Max retries exceeded, reject the promise
        // console.error(`💀 Task ${task.id} failed permanently after ${this.options.maxRetries} retries`)
        if (decision.failQueue) {
          this.failCurrentBacklog(error)
        }
        else {
          task.reject(error)
        }
      }
    }
    finally {
      // Ensure timeout is always cleared
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      if (this.executingTasks.get(task.hash) === task) {
        this.executingTasks.delete(task.hash)
      }
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

  private failCurrentBacklog(error: unknown) {
    if (this.nextScheduleTimer) {
      clearTimeout(this.nextScheduleTimer)
      this.nextScheduleTimer = null
    }

    for (const task of this.waitingTasks.values()) {
      this.rejectDrainedTask(task, error)
    }
    this.waitingTasks.clear()
    this.waitingQueue.clear()

    for (const task of this.executingTasks.values()) {
      this.rejectDrainedTask(task, error)
    }
    this.executingTasks.clear()
  }

  private rejectDrainedTask(task: QueuedRequestTask, error: unknown) {
    if (task.drained) {
      return
    }

    task.drained = true
    task.reject(error)
  }

  private refillTokens() {
    const now = Date.now()
    const timeSinceLastRefill = now - this.lastRefill
    const tokensToAdd = (timeSinceLastRefill / 1000) * this.options.rate
    this.bucketTokens = Math.min(this.bucketTokens + tokensToAdd, this.options.capacity)

    // if (tokensToAdd > 0.01) { // Only log if meaningful tokens were added
    //   console.log(`🪣 Token bucket refilled: ${oldTokens.toFixed(2)} -> ${this.bucketTokens.toFixed(2)} (+${tokensToAdd.toFixed(2)}) after ${timeSinceLastRefill}ms`)
    // }

    this.lastRefill = now
  }
}
