import { batchQueueConfigSchema } from "@/types/config/translate"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { TranslationCancelledError } from "./cancellation"

export class BatchCountMismatchError extends Error {
  constructor(expected: number, got: number, results: unknown[]) {
    super(
      `Batch result count mismatch: expected ${expected}, got ${got}.\nResults: ["${results.join('",\n"')}"]`,
    )
    this.name = "BatchCountMismatchError"
  }
}

const BASE_BACKOFF_DELAY_MS = 1000
const MAX_BACKOFF_DELAY_MS = 8000
// While the dispatch gate reports no free slot, re-poll it at least this often
// (the ETA shrinks as tokens refill downstream).
const MAX_GATE_POLL_MS = 1000
// Absolute cap on holding an under-filled batch: escape hatch if the gate
// reports large ETAs forever.
const MAX_BATCH_HOLD_MS = 60_000

/**
 * Port to the downstream dispatcher (ports & adapters: BatchQueue never learns
 * about RequestQueue). While the gate reports no free dispatch slot, pending
 * batches keep absorbing arrivals up to maxItems/maxChars instead of flushing
 * tiny at batchDelay — flushing earlier would not start the request any
 * earlier, it would only freeze the batch's composition.
 */
export interface DispatchGate {
  /**
   * ms until the downstream dispatcher could start ONE MORE request,
   * accounting for tokens, pauses, and requests already waiting ahead.
   * 0 = a slot is available now.
   */
  nextDispatchEtaMs: () => number
}

interface BatchTask<T, R> {
  data: T
  resolve: (value: R) => void
  reject: (error: Error) => void
  // Same refcounting contract as QueuedRequestTask.cancelScopes: `null` pins
  // the task (an unscoped subscriber exists); otherwise the task is cancelled
  // only when its last scope is cancelled.
  cancelScopes: Set<string> | null
  // Set once the batch has been handed to executeBatch: its scope snapshot is
  // now frozen downstream, so late dedup subscribers must NOT join it (#1881).
  flushed: boolean
}

interface PendingBatch<T, R> {
  id: string
  tasks: BatchTask<T, R>[]
  totalCharacters: number
  createdAt: number
}

export interface BatchExecutionMeta {
  /**
   * Union of the live members' cancellation scopes at flush time, or
   * `undefined` when any member is uncancellable. Thread this into the
   * downstream RequestQueue so cancelling the scopes aborts the whole batch.
   */
  scopes: readonly string[] | undefined
}

export interface BatchOptions<T, R> {
  maxCharactersPerBatch: number
  maxItemsPerBatch: number
  batchDelay: number
  maxRetries?: number
  enableFallbackToIndividual?: boolean
  dispatchGate?: DispatchGate
  getBatchKey: (data: T) => string
  getCharacters: (data: T) => number
  getDedupKey?: (data: T) => string | undefined
  getScope?: (data: T) => string | undefined
  // Liveness check for a scope whose cancel may have run while a flushed
  // batch was outside every cancellable structure (retry backoff sleep).
  isScopeCancelled?: (scopeKey: string) => boolean
  executeBatch: (dataList: T[], meta: BatchExecutionMeta) => Promise<R[]>
  executeIndividual?: (data: T) => Promise<R>
  onError?: (
    error: Error,
    context: { batchKey: string; retryCount: number; isFallback: boolean },
  ) => void
}

export class BatchQueue<T, R> {
  private pendingBatchMap = new Map<string, PendingBatch<T, R>>()
  private inFlightTasks = new Map<string, { promise: Promise<R>; task: BatchTask<T, R> }>()
  private nextScheduleTimer: NodeJS.Timeout | null = null
  private maxCharactersPerBatch: number
  private maxItemsPerBatch: number
  private batchDelay: number
  private maxRetries: number
  private enableFallbackToIndividual: boolean
  private dispatchGate?: DispatchGate
  private getBatchKey: (data: T) => string
  private getCharacters: (data: T) => number
  private getDedupKey?: (data: T) => string | undefined
  private getScope?: (data: T) => string | undefined
  private isScopeCancelled?: (scopeKey: string) => boolean
  private executeBatch: (dataList: T[], meta: BatchExecutionMeta) => Promise<R[]>
  private executeIndividual?: (data: T) => Promise<R>
  private onError?: (
    error: Error,
    context: { batchKey: string; retryCount: number; isFallback: boolean },
  ) => void

  constructor(config: BatchOptions<T, R>) {
    this.maxCharactersPerBatch = config.maxCharactersPerBatch
    this.maxItemsPerBatch = config.maxItemsPerBatch
    this.batchDelay = config.batchDelay
    this.maxRetries = config.maxRetries ?? 3
    this.enableFallbackToIndividual = config.enableFallbackToIndividual ?? true
    this.dispatchGate = config.dispatchGate
    this.getBatchKey = config.getBatchKey
    this.getCharacters = config.getCharacters
    this.getDedupKey = config.getDedupKey
    this.getScope = config.getScope
    this.isScopeCancelled = config.isScopeCancelled
    this.executeBatch = config.executeBatch
    this.executeIndividual = config.executeIndividual
    this.onError = config.onError
  }

  enqueue(data: T): Promise<R> {
    const scope = this.getScope?.(data)
    const dedupKey = this.getDedupKey?.(data)
    if (dedupKey) {
      const inFlight = this.inFlightTasks.get(dedupKey)
      // Only join a still-pending batch: its cancelScopes set is mutable and
      // its flush-time union will include this scope. A flushed batch has
      // already handed a FROZEN scope snapshot to the RequestQueue, so a late
      // cross-scope subscriber joining it would be cancelled when the original
      // scope cancels — silently dropping this (still-active) session's
      // paragraph. Fall through to a fresh task instead; the RequestQueue's own
      // hash dedup re-coalesces identical batches, so the common case (two tabs
      // on the same page) stays deduped, and at worst one duplicate request is
      // issued for a genuinely different batch (#1881).
      if (inFlight && !inFlight.task.flushed) {
        if (!scope) {
          inFlight.task.cancelScopes = null
        } else if (inFlight.task.cancelScopes !== null) {
          inFlight.task.cancelScopes.add(scope)
        }
        return inFlight.promise
      }
    }

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
      cancelScopes: scope ? new Set([scope]) : null,
      flushed: false,
    }

    if (dedupKey) {
      this.inFlightTasks.set(dedupKey, { promise, task })
      const release = () => {
        if (this.inFlightTasks.get(dedupKey)?.promise === promise) {
          this.inFlightTasks.delete(dedupKey)
        }
      }
      promise.then(release, release)
    }

    this.addTaskToBatch(task, batchKey)
    this.schedule()

    return promise
  }

  /**
   * Cancel every not-yet-flushed member subscribed to the given scope (see
   * RequestQueue.cancelByScope for the refcounting contract). Batches already
   * flushed live as a single RequestQueue task carrying the scope union —
   * cancel them there.
   */
  cancelByScope(scopeKey: string): number {
    return this.cancelWhere((scope) => scope === scopeKey)
  }

  cancelWhere(scopeMatches: (scopeKey: string) => boolean): number {
    let cancelled = 0
    for (const [batchKey, batch] of [...this.pendingBatchMap]) {
      const kept: BatchTask<T, R>[] = []
      for (const task of batch.tasks) {
        const scopes = task.cancelScopes
        if (scopes === null) {
          kept.push(task)
          continue
        }
        let matchedScope: string | undefined
        for (const scope of scopes) {
          if (scopeMatches(scope)) {
            matchedScope = scope
            scopes.delete(scope)
          }
        }
        if (matchedScope === undefined || scopes.size > 0) {
          kept.push(task)
          continue
        }
        // inFlightTasks self-releases via the promise.then(release, release)
        // handler attached at enqueue time.
        task.reject(new TranslationCancelledError(matchedScope))
        cancelled++
      }
      if (kept.length === 0) {
        this.pendingBatchMap.delete(batchKey)
      } else if (kept.length !== batch.tasks.length) {
        batch.tasks = kept
        batch.totalCharacters = kept.reduce((sum, task) => sum + this.getCharacters(task.data), 0)
      }
    }
    if (this.pendingBatchMap.size === 0 && this.nextScheduleTimer) {
      clearTimeout(this.nextScheduleTimer)
      this.nextScheduleTimer = null
    }
    return cancelled
  }

  private schedule() {
    if (this.nextScheduleTimer) {
      clearTimeout(this.nextScheduleTimer)
      this.nextScheduleTimer = null
    }

    const now = Date.now()
    const etaMs = this.dispatchGate?.nextDispatchEtaMs() ?? 0
    const batchesToFlush: string[] = []
    let nextWakeMs = Infinity

    for (const [batchKey, batch] of this.pendingBatchMap.entries()) {
      // Size-full: always flush — the batch's composition is already maximal.
      if (this.shouldFlushBatch(batch)) {
        batchesToFlush.push(batchKey)
        continue
      }

      const ageMs = now - batch.createdAt
      // A dispatch slot is (nearly) available downstream — flushing now costs
      // nothing. Without a gate this is always true, preserving the original
      // flush-at-batchDelay latency.
      const slotNear = etaMs <= this.batchDelay
      if (ageMs >= this.batchDelay && (slotNear || ageMs >= MAX_BATCH_HOLD_MS)) {
        batchesToFlush.push(batchKey)
        continue
      }

      // Hold: wake when the min-age elapses, or poll the gate again soon —
      // whichever is later — so held batches keep absorbing arrivals while
      // dispatch is blocked.
      const wakeMs = Math.max(
        this.batchDelay - ageMs,
        Math.min(Math.max(etaMs - this.batchDelay, this.batchDelay), MAX_GATE_POLL_MS),
      )
      nextWakeMs = Math.min(nextWakeMs, wakeMs)
    }

    for (const batchKey of batchesToFlush) {
      this.flushPendingBatchByKey(batchKey)
    }

    if (this.pendingBatchMap.size > 0) {
      this.nextScheduleTimer = setTimeout(
        () => {
          this.nextScheduleTimer = null
          this.schedule()
        },
        Number.isFinite(nextWakeMs) ? nextWakeMs : this.batchDelay,
      )
    }
  }

  private addTaskToBatch(task: BatchTask<T, R>, batchKey: string) {
    const characters = this.getCharacters(task.data)
    const existingBatch = this.pendingBatchMap.get(batchKey)

    if (existingBatch) {
      if (existingBatch.totalCharacters + characters <= this.maxCharactersPerBatch) {
        existingBatch.tasks.push(task)
        existingBatch.totalCharacters += characters
      } else {
        this.flushPendingBatchByKey(batchKey)
        this.createNewPendingBatch(task, batchKey)
      }
    } else {
      this.createNewPendingBatch(task, batchKey)
    }
  }

  private shouldFlushBatch(batch: PendingBatch<T, R>): boolean {
    return (
      batch.tasks.length >= this.maxItemsPerBatch ||
      batch.totalCharacters >= this.maxCharactersPerBatch
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
    if (!pendingBatch) return

    this.pendingBatchMap.delete(batchKey)

    const { tasks } = pendingBatch
    // Freeze the batch: from here its downstream scope snapshot is fixed, so
    // enqueue() must stop letting late subscribers dedup into these tasks.
    for (const task of tasks) task.flushed = true

    // Scope union frozen at flush time: if every member is scoped, cancelling
    // all those scopes downstream aborts the whole batch; one unscoped member
    // pins it (scopes: undefined).
    let scopes: string[] | undefined = []
    for (const task of tasks) {
      if (task.cancelScopes === null) {
        scopes = undefined
        break
      }
      scopes.push(...task.cancelScopes)
    }
    const meta: BatchExecutionMeta = { scopes: scopes ? [...new Set(scopes)] : undefined }

    void this.executeBatchWithRetry(tasks, batchKey, meta, 0)
  }

  private async executeBatchWithRetry(
    tasks: BatchTask<T, R>[],
    batchKey: string,
    meta: BatchExecutionMeta,
    retryCount: number,
  ): Promise<void> {
    try {
      const results = await this.executeBatch(
        tasks.map((task) => task.data),
        meta,
      )

      if (!results) {
        throw new Error("Batch execution results are undefined")
      }

      if (results.length !== tasks.length) {
        throw new BatchCountMismatchError(tasks.length, results.length, results)
      }

      tasks.forEach((task, index) => task.resolve(results[index]))
    } catch (error) {
      const err = error as Error

      this.onError?.(err, { batchKey, retryCount, isFallback: false })

      // Only retry on count mismatch errors (LLM returned wrong number of results)
      if (retryCount < this.maxRetries && err instanceof BatchCountMismatchError) {
        const delay = this.calculateBackoffDelay(retryCount)
        await this.sleep(delay)
        // During the backoff this batch lived in NO cancellable structure
        // (its RequestQueue task already completed, it left pendingBatchMap at
        // flush) — a cancel that arrived meanwhile drained nothing, so re-check
        // scope liveness before burning another provider round trip (#1881).
        if (this.rejectIfAllScopesCancelled(tasks, meta)) return
        return this.executeBatchWithRetry(tasks, batchKey, meta, retryCount + 1)
      }

      if (
        this.enableFallbackToIndividual &&
        this.executeIndividual &&
        err instanceof BatchCountMismatchError
      ) {
        // Same gate before the per-item fallback: the failed attempt's provider
        // call may have straddled the cancel.
        if (this.rejectIfAllScopesCancelled(tasks, meta)) return
        return this.executeFallbackIndividual(tasks, batchKey)
      }

      tasks.forEach((task) => task.reject(err))
    }
  }

  /**
   * When every scope this batch was flushed with has since been cancelled,
   * reject all members with the cancellation error and report true. A batch
   * with an unscoped member (scopes: undefined) or any surviving scope keeps
   * running — same mixed-batch semantics as cancelByScope.
   */
  private rejectIfAllScopesCancelled(tasks: BatchTask<T, R>[], meta: BatchExecutionMeta): boolean {
    if (!this.isScopeCancelled || !meta.scopes || meta.scopes.length === 0) return false
    if (!meta.scopes.every((scope) => this.isScopeCancelled!(scope))) return false
    const error = new TranslationCancelledError(meta.scopes.join(","))
    tasks.forEach((task) => task.reject(error))
    return true
  }

  private async executeFallbackIndividual(tasks: BatchTask<T, R>[], batchKey: string) {
    await Promise.allSettled(
      tasks.map(async (task) => {
        try {
          if (!this.executeIndividual) {
            throw new Error("executeIndividual is not defined")
          }
          const result = await this.executeIndividual(task.data)
          task.resolve(result)
        } catch (error) {
          const err = error as Error
          this.onError?.(err, { batchKey, retryCount: this.maxRetries, isFallback: true })
          task.reject(err)
        }
      }),
    )
  }

  private calculateBackoffDelay(retryCount: number): number {
    return Math.min(BASE_BACKOFF_DELAY_MS * 2 ** retryCount, MAX_BACKOFF_DELAY_MS)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  setBatchConfig(
    config: Partial<Pick<BatchOptions<T, R>, "maxCharactersPerBatch" | "maxItemsPerBatch">>,
  ) {
    const parseConfigStatus = batchQueueConfigSchema.partial().safeParse(config)
    if (parseConfigStatus.error) {
      throw new Error(parseConfigStatus.error.issues[0].message)
    }

    this.maxCharactersPerBatch = config.maxCharactersPerBatch ?? this.maxCharactersPerBatch
    this.maxItemsPerBatch = config.maxItemsPerBatch ?? this.maxItemsPerBatch
  }
}
