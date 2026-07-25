import { afterEach, describe, expect, it, vi } from "vitest"
import { BatchCountMismatchError, BatchQueue } from "../batch-queue"
import { isTranslationCancelledError, TranslationCancelledError } from "../cancellation"
import { RequestQueue } from "../request-queue"

const baseConfig = {
  rate: 1, // 1 token / sec
  capacity: 1, // bucket size 1
  timeoutMs: 10_000,
  maxRetries: 0,
  baseRetryDelayMs: 100,
} as const

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function expectCancelled(promise: Promise<unknown>): Promise<void> {
  let caught: unknown
  try {
    await promise
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(Error)
  expect((caught as Error).name).toBe("TranslationCancelledError")
  expect(isTranslationCancelledError(caught)).toBe(true)
}

afterEach(() => {
  vi.useRealTimers()
})

describe("requestQueue – cancelByScope", () => {
  it("rejects waiting tasks without running their thunks and aborts the executing one", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue(baseConfig)

    const executing = createDeferred<string>()
    let executingSignal: AbortSignal | undefined
    const p1 = q.enqueue(
      (signal) => {
        executingSignal = signal
        return executing.promise
      },
      Date.now(),
      "h1",
      ["A"],
    )

    const thunk2 = vi.fn<() => Promise<string>>(async () => "two")
    const thunk3 = vi.fn<() => Promise<string>>(async () => "three")
    const p2 = q.enqueue(thunk2, Date.now(), "h2", ["A"])
    const p3 = q.enqueue(thunk3, Date.now(), "h3", ["A"])

    await vi.advanceTimersByTimeAsync(0)
    expect(executingSignal).toBeDefined()

    const cancelled = q.cancelByScope("A")
    expect(cancelled).toBe(3)

    await expectCancelled(p1)
    await expectCancelled(p2)
    await expectCancelled(p3)
    expect(thunk2).not.toHaveBeenCalled()
    expect(thunk3).not.toHaveBeenCalled()
    expect(executingSignal!.aborted).toBe(true)
  })

  it("does not retry a cancelled executing task", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({ ...baseConfig, maxRetries: 2 })

    let attempts = 0
    const promise = q.enqueue(
      (signal) =>
        new Promise((_, reject) => {
          attempts += 1
          signal?.addEventListener("abort", () => reject(signal.reason))
        }),
      Date.now(),
      "hang",
      ["A"],
    )
    const settled = expectCancelled(promise)

    await vi.advanceTimersByTimeAsync(0)
    expect(attempts).toBe(1)

    q.cancelByScope("A")
    await settled

    // Advance past every retry window — no further attempts may start.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(attempts).toBe(1)
  })

  it("keeps a dedup-shared task alive while another scope still needs it", async () => {
    const q = new RequestQueue({ ...baseConfig, rate: 100, capacity: 100 })

    const gate = createDeferred<string>()
    const thunk = vi.fn<() => Promise<string>>(() => gate.promise)
    const scheduledAt = Date.now() + 5_000

    vi.useFakeTimers()
    const fromA = q.enqueue(thunk, scheduledAt, "shared", ["A"])
    const fromB = q.enqueue(thunk, scheduledAt, "shared", ["B"])
    expect(fromB).toBe(fromA)

    expect(q.cancelByScope("A")).toBe(0)

    await vi.advanceTimersByTimeAsync(6_000)
    gate.resolve("value")
    await expect(fromA).resolves.toBe("value")
    expect(thunk).toHaveBeenCalledTimes(1)
  })

  it("cancels a dedup-shared task when every scope is cancelled", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue(baseConfig)

    const thunk = vi.fn<() => Promise<string>>(async () => "value")
    const scheduledAt = Date.now() + 5_000
    const fromA = q.enqueue(thunk, scheduledAt, "shared", ["A"])
    void q.enqueue(thunk, scheduledAt, "shared", ["B"])

    q.cancelByScope("A")
    expect(q.cancelByScope("B")).toBe(1)

    await expectCancelled(fromA)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(thunk).not.toHaveBeenCalled()
  })

  it("is pinned by an unscoped duplicate subscriber", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue(baseConfig)

    const thunk = vi.fn<() => Promise<string>>(async () => "value")
    const scheduledAt = Date.now() + 1_000
    const fromA = q.enqueue(thunk, scheduledAt, "shared", ["A"])
    const unscoped = q.enqueue(thunk, scheduledAt, "shared")

    expect(q.cancelByScope("A")).toBe(0)

    await vi.advanceTimersByTimeAsync(2_000)
    await expect(fromA).resolves.toBe("value")
    await expect(unscoped).resolves.toBe("value")
  })

  it("keeps the heap dispatching surviving tasks in schedule order after selective removal", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({ ...baseConfig, rate: 1000, capacity: 1000 })
    const started: string[] = []
    const now = Date.now()

    const enqueueTracked = (name: string, delayMs: number, scope: string) =>
      q.enqueue(
        async () => {
          started.push(name)
          return name
        },
        now + delayMs,
        name,
        [scope],
      )

    const survivors = [
      enqueueTracked("b1", 300, "B"),
      enqueueTracked("b2", 100, "B"),
      enqueueTracked("b3", 500, "B"),
    ]
    const doomed = [
      enqueueTracked("a1", 50, "A"),
      enqueueTracked("a2", 200, "A"),
      enqueueTracked("a3", 400, "A"),
    ]
    doomed.forEach((p) => p.catch(() => {}))

    q.cancelByScope("A")

    await vi.advanceTimersByTimeAsync(1_000)
    await Promise.all(survivors)
    expect(started).toEqual(["b2", "b1", "b3"])
  })

  it("allows re-enqueueing the same hash after cancellation", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue(baseConfig)

    const first = q.enqueue(async () => "first", Date.now() + 5_000, "same", ["A"])
    q.cancelByScope("A")
    await expectCancelled(first)

    const second = q.enqueue(async () => "second", Date.now(), "same", ["A"])
    await vi.advanceTimersByTimeAsync(0)
    await expect(second).resolves.toBe("second")
  })

  it("cancels a task waiting in its retry backoff window", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({ ...baseConfig, maxRetries: 3, baseRetryDelayMs: 1_000 })

    let attempts = 0
    const promise = q.enqueue(
      async () => {
        attempts += 1
        throw new Error("transient")
      },
      Date.now(),
      "retrying",
      ["A"],
    )
    const settled = expectCancelled(promise)

    // First attempt fails and schedules a retry.
    await vi.advanceTimersByTimeAsync(10)
    expect(attempts).toBe(1)

    q.cancelByScope("A")
    await settled
    await vi.advanceTimersByTimeAsync(60_000)
    expect(attempts).toBe(1)
  })

  it("cancelWhere matches scope prefixes (tab close sweep)", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue(baseConfig)

    const fromTab7 = q.enqueue(async () => "seven", Date.now() + 5_000, "h7", ["7:sess-a"])
    const fromTab8 = q.enqueue(async () => "eight", Date.now() + 5_000, "h8", ["8:sess-b"])

    expect(q.cancelWhere((scope) => scope.startsWith("7:"))).toBe(1)
    await expectCancelled(fromTab7)

    await vi.advanceTimersByTimeAsync(10_000)
    await expect(fromTab8).resolves.toBe("eight")
  })
})

interface FakeBatchData {
  text: string
  key: string
  scope?: string
}

function createBatchQueue(options: {
  executeBatch: (
    dataList: FakeBatchData[],
    meta: { scopes: readonly string[] | undefined },
  ) => Promise<string[]>
  executeIndividual?: (data: FakeBatchData) => Promise<string>
  batchDelay?: number
  maxItemsPerBatch?: number
  maxRetries?: number
  isScopeCancelled?: (scopeKey: string) => boolean
}) {
  return new BatchQueue<FakeBatchData, string>({
    maxCharactersPerBatch: 1_000,
    maxItemsPerBatch: options.maxItemsPerBatch ?? 10,
    batchDelay: options.batchDelay ?? 100,
    maxRetries: options.maxRetries ?? 0,
    enableFallbackToIndividual: Boolean(options.executeIndividual),
    getBatchKey: () => "batch",
    getCharacters: (data) => data.text.length,
    getDedupKey: (data) => data.key,
    getScope: (data) => data.scope,
    isScopeCancelled: options.isScopeCancelled,
    executeBatch: options.executeBatch,
    executeIndividual: options.executeIndividual,
  })
}

describe("batchQueue – cancelByScope", () => {
  it("drops cancelled members from a pending batch and flushes only survivors", async () => {
    vi.useFakeTimers()
    const executeBatch = vi.fn<(dataList: FakeBatchData[]) => Promise<string[]>>(async (dataList) =>
      dataList.map((d) => `t:${d.text}`),
    )
    const q = createBatchQueue({ executeBatch })

    const a1 = q.enqueue({ text: "alpha", key: "a1", scope: "A" })
    const a2 = q.enqueue({ text: "beta", key: "a2", scope: "A" })
    const b1 = q.enqueue({ text: "gamma", key: "b1", scope: "B" })

    expect(q.cancelByScope("A")).toBe(2)
    await expectCancelled(a1)
    await expectCancelled(a2)

    await vi.advanceTimersByTimeAsync(200)
    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeBatch.mock.calls[0][0].map((d: FakeBatchData) => d.text)).toEqual(["gamma"])
    await expect(b1).resolves.toBe("t:gamma")
  })

  it("cancelling every member drops the batch entirely and stops the timer", async () => {
    vi.useFakeTimers()
    const executeBatch = vi.fn<(dataList: FakeBatchData[]) => Promise<string[]>>(async (dataList) =>
      dataList.map((d) => `t:${d.text}`),
    )
    const q = createBatchQueue({ executeBatch })

    const a1 = q.enqueue({ text: "alpha", key: "a1", scope: "A" })
    const a2 = q.enqueue({ text: "beta", key: "a2", scope: "A" })

    q.cancelByScope("A")
    await expectCancelled(a1)
    await expectCancelled(a2)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(executeBatch).not.toHaveBeenCalled()
  })

  it("refcounts dedup subscribers across scopes", async () => {
    vi.useFakeTimers()
    const executeBatch = vi.fn<(dataList: FakeBatchData[]) => Promise<string[]>>(async (dataList) =>
      dataList.map((d) => `t:${d.text}`),
    )
    const q = createBatchQueue({ executeBatch })

    const fromA = q.enqueue({ text: "shared", key: "same", scope: "A" })
    const fromB = q.enqueue({ text: "shared", key: "same", scope: "B" })
    expect(fromB).toBe(fromA)

    // A alone is not enough to cancel the shared member.
    expect(q.cancelByScope("A")).toBe(0)
    await vi.advanceTimersByTimeAsync(200)
    await expect(fromA).resolves.toBe("t:shared")

    // A fresh enqueue with the same dedup key creates a new task (released).
    const again = q.enqueue({ text: "shared", key: "same", scope: "B" })
    expect(again).not.toBe(fromA)
    q.cancelByScope("B")
    await expectCancelled(again)
  })

  it("aborts an in-flight all-cancelled batch through the request queue without individual fallback", async () => {
    vi.useFakeTimers()
    const requestQueue = new RequestQueue({ ...baseConfig, rate: 100, capacity: 100 })
    let batchSignal: AbortSignal | undefined
    const executeIndividual = vi.fn<(data: FakeBatchData) => Promise<string>>(
      async (item) => `solo:${item.text}`,
    )

    const q = createBatchQueue({
      batchDelay: 10,
      executeBatch: (dataList, meta) =>
        requestQueue.enqueue(
          (signal) =>
            new Promise<string[]>((_, reject) => {
              batchSignal = signal
              signal?.addEventListener("abort", () => reject(signal.reason))
            }),
          Date.now(),
          `batch:${dataList.map((d) => d.key).join(",")}`,
          meta.scopes,
        ),
      executeIndividual,
    })

    const a1 = q.enqueue({ text: "alpha", key: "a1", scope: "A" })
    const a2 = q.enqueue({ text: "beta", key: "a2", scope: "A" })
    const settled = Promise.all([expectCancelled(a1), expectCancelled(a2)])

    // Flush the pending batch into the request queue and start executing.
    await vi.advanceTimersByTimeAsync(50)
    expect(batchSignal).toBeDefined()

    // Pending members are gone; the flushed batch task carries the scope.
    q.cancelByScope("A")
    requestQueue.cancelByScope("A")

    await settled
    expect(batchSignal!.aborted).toBe(true)
    expect(batchSignal!.reason).toBeInstanceOf(TranslationCancelledError)
    expect(executeIndividual).not.toHaveBeenCalled()
  })

  it("lets an in-flight mixed batch complete for every member", async () => {
    vi.useFakeTimers()
    const requestQueue = new RequestQueue({ ...baseConfig, rate: 100, capacity: 100 })
    const gate = createDeferred<void>()

    const q = createBatchQueue({
      batchDelay: 10,
      executeBatch: (dataList, meta) =>
        requestQueue.enqueue(
          async () => {
            await gate.promise
            return dataList.map((d) => `t:${d.text}`)
          },
          Date.now(),
          `batch:${dataList.map((d) => d.key).join(",")}`,
          meta.scopes,
        ),
    })

    const fromA = q.enqueue({ text: "alpha", key: "a1", scope: "A" })
    const fromB = q.enqueue({ text: "beta", key: "b1", scope: "B" })

    await vi.advanceTimersByTimeAsync(50)

    // Only scope A cancels — the mixed batch must keep running to completion.
    q.cancelByScope("A")
    requestQueue.cancelByScope("A")

    gate.resolve()
    await expect(fromA).resolves.toBe("t:alpha")
    await expect(fromB).resolves.toBe("t:beta")
  })

  it("does not drop a later session's paragraph that dedups a same-hash request after flush (#1881)", async () => {
    vi.useFakeTimers()
    const requestQueue = new RequestQueue({ ...baseConfig, rate: 100, capacity: 100 })
    const gate = createDeferred<void>()
    const signals: Record<string, AbortSignal | undefined> = {}
    let rqSeq = 0

    const q = createBatchQueue({
      batchDelay: 10,
      // Unique downstream hash per flush so the two sessions land on distinct
      // RequestQueue tasks — this isolates the BatchQueue-level fix (the
      // request queue's own dedup would otherwise mask it).
      executeBatch: (dataList, meta) => {
        const scopeKey = meta.scopes?.[0]
        return requestQueue.enqueue(
          (signal) =>
            new Promise<string[]>((resolve, reject) => {
              if (scopeKey) signals[scopeKey] = signal
              signal?.addEventListener("abort", () => reject(signal.reason))
              void gate.promise.then(() => resolve(dataList.map((d) => `t:${d.text}`)))
            }),
          Date.now(),
          `rq-${rqSeq++}`,
          meta.scopes,
        )
      },
    })

    // Session A: same text, flushed into the request queue and now in flight.
    const fromA = q.enqueue({ text: "shared", key: "same", scope: "A" })
    const settledA = expectCancelled(fromA)
    await vi.advanceTimersByTimeAsync(20)

    // Session B: identical dedup key, but arriving AFTER A's batch flushed.
    const fromB = q.enqueue({ text: "shared", key: "same", scope: "B" })
    await vi.advanceTimersByTimeAsync(20)

    // The fix: B must not share A's frozen downstream task.
    expect(fromB).not.toBe(fromA)

    // A cancels; B stays active.
    q.cancelByScope("A")
    requestQueue.cancelByScope("A")
    await settledA
    expect(signals.A?.aborted).toBe(true)

    // B's paragraph completes instead of being silently dropped.
    gate.resolve()
    await expect(fromB).resolves.toBe("t:shared")
    expect(signals.B?.aborted).toBe(false)
  })

  it("aborts the retry backoff when every scope was cancelled during the sleep (#1881)", async () => {
    vi.useFakeTimers()
    const cancelled = new Set<string>()
    // First attempt: LLM returns the wrong number of results → retry path.
    const executeBatch = vi.fn<
      (
        dataList: FakeBatchData[],
        meta: { scopes: readonly string[] | undefined },
      ) => Promise<string[]>
    >(async () => {
      throw new BatchCountMismatchError(2, 1, ["only-one"])
    })
    const executeIndividual = vi.fn<(data: FakeBatchData) => Promise<string>>(
      async (item) => `solo:${item.text}`,
    )
    const q = createBatchQueue({
      batchDelay: 10,
      maxRetries: 3,
      executeBatch,
      executeIndividual,
      isScopeCancelled: (scope) => cancelled.has(scope),
    })

    const a1 = q.enqueue({ text: "alpha", key: "a1", scope: "A" })
    const a2 = q.enqueue({ text: "beta", key: "a2", scope: "A" })
    const settled = Promise.all([expectCancelled(a1), expectCancelled(a2)])

    // Flush → first attempt fails → batch enters its backoff sleep, where it
    // lives in no cancellable structure.
    await vi.advanceTimersByTimeAsync(20)
    expect(executeBatch).toHaveBeenCalledTimes(1)

    // The session cancels during the backoff (registry marks the scope).
    cancelled.add("A")

    // Past every backoff window: no second attempt, no per-item fallback.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeIndividual).not.toHaveBeenCalled()
    await settled
  })

  it("keeps retrying when the scopes stay live (control)", async () => {
    vi.useFakeTimers()
    const executeBatch = vi.fn<
      (
        dataList: FakeBatchData[],
        meta: { scopes: readonly string[] | undefined },
      ) => Promise<string[]>
    >(async (dataList) => {
      if (executeBatch.mock.calls.length === 1) {
        throw new BatchCountMismatchError(1, 0, [])
      }
      return dataList.map((d) => `t:${d.text}`)
    })
    const q = createBatchQueue({
      batchDelay: 10,
      maxRetries: 3,
      executeBatch,
      isScopeCancelled: () => false,
    })

    const a1 = q.enqueue({ text: "alpha", key: "a1", scope: "A" })

    await vi.advanceTimersByTimeAsync(20)
    expect(executeBatch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(executeBatch).toHaveBeenCalledTimes(2)
    await expect(a1).resolves.toBe("t:alpha")
  })
})
