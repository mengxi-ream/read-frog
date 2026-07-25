import type { RequestRetryPolicy } from "./retry-policy"
import { deepmerge } from "deepmerge-ts"
import { requestQueueConfigSchema } from "@/types/config/translate"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { TranslationCancelledError } from "./cancellation"
import { BinaryHeapPQ } from "./priority-queue"
import { defaultRequestRetryPolicy } from "./retry-policy"

export interface RequestTask {
  id: string
  thunk: (signal?: AbortSignal) => Promise<any>
  promise: Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  scheduleAt: number
  createdAt: number
  retryCount: number
  // 429 retries spent on this task; a separate budget from retryCount (see
  // RequestRetryContext.rateLimitRetryCount).
  rateLimitRetryCount: number
  drained: boolean
  // Per-task timeout override; falls back to QueueOptions.timeoutMs. Large
  // LLM batches need proportionally more time than single requests.
  timeoutMs?: number
}

type QueuedRequestTask = RequestTask & {
  hash: string
  abortController?: AbortController
  // Cancellation scopes subscribed to this task. Dedup can attach several
  // (same hash from multiple tabs/sessions); the task is only cancelled when
  // its LAST scope is cancelled. `null` means an unscoped subscriber exists,
  // which pins the task as uncancellable.
  cancelScopes: Set<string> | null
}

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

  // rate-limit pause: no dispatching while Date.now() < pausedUntil. Set on a
  // 429 (pause-and-retry decision); the backlog stays intact instead of being
  // mass-rejected.
  private pausedUntil = 0
  // Pause windows since the last successful request; feeds the retry policy's
  // give-up cap (MAX_CONSECUTIVE_RATE_LIMIT_PAUSES).
  private consecutiveRateLimits = 0

  constructor(private options: QueueOptions) {
    this.retryPolicy = options.retryPolicy ?? defaultRequestRetryPolicy
    this.bucketTokens = options.capacity
    this.lastRefill = Date.now()
    this.waitingQueue = new BinaryHeapPQ<QueuedRequestTask>()
  }

  enqueue<T>(
    thunk: (signal?: AbortSignal) => Promise<T>,
    scheduleAt: number,
    hash: string,
    scopes?: readonly string[],
    taskOptions?: { timeoutMs?: number },
  ): Promise<T> {
    const duplicateTask = this.duplicateTask(hash)
    if (duplicateTask) {
      // console.info(`🔄 Found duplicate task for hash: ${hash}, returning existing promise`)
      if (!scopes?.length) {
        duplicateTask.cancelScopes = null
      } else if (duplicateTask.cancelScopes !== null) {
        scopes.forEach((scope) => duplicateTask.cancelScopes!.add(scope))
      }
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
      rateLimitRetryCount: 0,
      drained: false,
      timeoutMs: taskOptions?.timeoutMs,
      cancelScopes: scopes?.length ? new Set(scopes) : null,
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
    // Settle token accrual under the OLD rate before switching.
    this.refillTokens()
    this.options = deepmerge(this.options, queueOptions) as QueueOptions
    if (retryPolicy) {
      this.retryPolicy = retryPolicy
    }
    // Clamp, never refill-to-full: a capacity edit must not grant a free
    // burst, and repeated identical calls (config sync) must be no-ops.
    this.bucketTokens = Math.min(this.bucketTokens, this.options.capacity)
    // The pending timer's delay was computed under the old rate — recompute.
    this.schedule()
  }

  /**
   * Cancel every task subscribed to the given scope. Refcounted: a task shared
   * with another scope (dedup) or with an unscoped subscriber survives; only
   * tasks whose LAST scope this is are rejected/aborted (#1881).
   */
  cancelByScope(scopeKey: string): number {
    return this.cancelWhere((scope) => scope === scopeKey)
  }

  /**
   * Cancel every task all of whose scopes match the predicate. Unscoped tasks
   * (`cancelScopes === null`) never match.
   */
  cancelWhere(scopeMatches: (scopeKey: string) => boolean): number {
    let cancelled = 0

    const cancelMatchingScopes = (task: QueuedRequestTask): boolean => {
      if (task.cancelScopes === null) return false
      let matchedScope: string | undefined
      for (const scope of task.cancelScopes) {
        if (scopeMatches(scope)) {
          matchedScope = scope
          task.cancelScopes.delete(scope)
        }
      }
      if (matchedScope === undefined || task.cancelScopes.size > 0) return false
      this.rejectDrainedTask(task, new TranslationCancelledError(matchedScope))
      return true
    }

    for (const [hash, task] of [...this.waitingTasks]) {
      if (!cancelMatchingScopes(task)) continue
      this.waitingTasks.delete(hash)
      cancelled++
    }
    this.waitingQueue.removeWhere((task) => task.drained)

    for (const [hash, task] of [...this.executingTasks]) {
      if (!cancelMatchingScopes(task)) continue
      this.executingTasks.delete(hash)
      cancelled++
    }

    if (cancelled > 0) {
      this.schedule()
    }
    return cancelled
  }

  /**
   * Milliseconds until this queue could START one more (newly enqueued)
   * request: accounts for the rate-limit pause, available tokens, and the
   * requests already waiting ahead of it. 0 = a slot is available now.
   * Consumed by the BatchQueue's dispatch gate so batches keep filling while
   * dispatch is blocked instead of flushing tiny.
   */
  nextDispatchEtaMs(): number {
    this.refillTokens()
    const now = Date.now()
    const pauseDelayMs = Math.max(0, this.pausedUntil - now)
    const tokensNeeded = this.waitingQueue.size() + 1
    const tokenDelayMs =
      this.bucketTokens >= tokensNeeded
        ? 0
        : Math.ceil(((tokensNeeded - this.bucketTokens) / this.options.rate) * 1000)
    return Math.max(pauseDelayMs, tokenDelayMs)
  }

  private schedule() {
    this.refillTokens()
    this.clearScheduleTimer()

    const pauseRemainingMs = this.pausedUntil - Date.now()
    if (pauseRemainingMs > 0) {
      if (this.waitingQueue.size() > 0) {
        this.armScheduleTimer(pauseRemainingMs)
      }
      return
    }

    while (this.bucketTokens >= 1 && this.waitingQueue.size() > 0) {
      const now = Date.now()

      const task = this.waitingQueue.peek()
      if (task?.drained) {
        // Safety net: a drained task should have been removed from the heap,
        // but never dispatch or let one stall the timer computation below.
        this.waitingQueue.pop()
        this.waitingTasks.delete(task.hash)
        continue
      }
      if (task && task.scheduleAt <= now) {
        this.waitingQueue.pop()
        this.waitingTasks.delete(task.hash)
        this.executingTasks.set(task.hash, task)
        this.bucketTokens--
        void this.executeTask(task)
      } else {
        break
      }
    }

    if (this.waitingQueue.size() > 0) {
      const nextTask = this.waitingQueue.peek()
      if (nextTask) {
        const now = Date.now()
        const delayUntilScheduled = Math.max(0, nextTask.scheduleAt - now)
        const msUntilNextToken =
          this.bucketTokens >= 1
            ? 0
            : Math.ceil(((1 - this.bucketTokens) / this.options.rate) * 1000)
        const delay = Math.max(delayUntilScheduled, msUntilNextToken)

        this.armScheduleTimer(delay)
      }
    }
  }

  private clearScheduleTimer() {
    if (this.nextScheduleTimer) {
      clearTimeout(this.nextScheduleTimer)
      this.nextScheduleTimer = null
    }
  }

  private armScheduleTimer(delayMs: number) {
    this.nextScheduleTimer = setTimeout(() => {
      this.nextScheduleTimer = null
      this.schedule()
    }, delayMs)
  }

  private async executeTask(task: QueuedRequestTask) {
    // console.info(`🏃 Starting execution of task ${task.id} (attempt ${task.retryCount + 1}) at ${Date.now()}`)

    let timeoutId: NodeJS.Timeout | null = null
    const abortController = new AbortController()
    task.abortController = abortController
    const timeoutMs = task.timeoutMs ?? this.options.timeoutMs

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          // console.info(`⏰ Task ${task.id} timed out after ${timeoutMs}ms`)
          const timeoutError = new Error(`Task ${task.id} timed out after ${timeoutMs}ms`)
          // Reject before aborting: the race must settle with the timeout error
          // (which the retry policy treats as retryable), not with whatever abort
          // error the cancelled thunk rejects with.
          reject(timeoutError)
          abortController.abort(timeoutError)
        }, timeoutMs)
      })

      // Race between the actual task and timeout; the signal cancels the
      // in-flight attempt on timeout so a retry never runs concurrently with it
      const result = await Promise.race([task.thunk(abortController.signal), timeoutPromise])

      // Clear timeout if task completed successfully
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // console.info(`✅ Task ${task.id} completed successfully at ${Date.now()}`)
      // Any completed request proves the provider recovered from rate limiting.
      this.consecutiveRateLimits = 0
      if (!task.drained) {
        task.resolve(result)
      }
    } catch (error) {
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
        rateLimitRetryCount: task.rateLimitRetryCount,
        consecutiveRateLimits: this.consecutiveRateLimits,
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
      } else if (decision.action === "pause-and-retry") {
        // Rate limited: pause dispatching and re-enqueue the task instead of
        // draining the backlog. Count one pause per pause WINDOW, not per
        // failing sibling — with capacity>1 several in-flight attempts can all
        // 429 within milliseconds; only the first (arriving un-paused)
        // increments the consecutive counter, the rest just extend the pause.
        if (now >= this.pausedUntil) {
          this.consecutiveRateLimits++
        }
        this.pausedUntil = Math.max(this.pausedUntil, now + decision.pauseMs)
        // Post-pause probe: resume with at most one token so recovery sends a
        // single request first instead of bursting `capacity` requests at a
        // provider that may still be limited.
        this.bucketTokens = Math.min(this.bucketTokens, 1)
        this.lastRefill = now
        task.rateLimitRetryCount++
        task.scheduleAt = this.pausedUntil
        this.waitingTasks.set(task.hash, task)
        this.waitingQueue.push(task, task.scheduleAt)
        this.schedule()
      } else {
        // Max retries exceeded, reject the promise
        // console.error(`💀 Task ${task.id} failed permanently after ${this.options.maxRetries} retries`)
        if (decision.failQueue) {
          this.failCurrentBacklog(error)
        } else {
          task.reject(error)
        }
      }
    } finally {
      // Ensure timeout is always cleared
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      if (task.abortController === abortController) {
        task.abortController = undefined
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
    // A fresh user retry after this mass-fail gets a fresh pause budget, but
    // pausedUntil is kept: new enqueues still respect the provider's cooldown.
    this.consecutiveRateLimits = 0
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
    task.abortController?.abort(error)
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
