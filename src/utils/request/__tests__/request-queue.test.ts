import { afterEach, describe, expect, it, vi } from "vitest"
import { RequestQueue } from "../request-queue"

// Convenience helper: returns a thunk that resolves with <value>
// after <delayMs> real / fake milliseconds.
function makeThunk<T>(value: T, delayMs = 0) {
  return () => new Promise<T>((res) => setTimeout(res, delayMs, value))
}

// rejectThunk – rejects after delayMs
function rejectThunk(error: any, delayMs = 0) {
  return () => new Promise((_, rej) => setTimeout(rej, delayMs, error))
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// A basic queue config we reuse (easy to tweak per‑test)
const baseConfig = {
  rate: 1, // 1 token / sec
  capacity: 1, // bucket size 1
  timeoutMs: 10_000,
  maxRetries: 0,
  baseRetryDelayMs: 100,
} as const

// Restore timers after each test so later suites aren't affected.
afterEach(() => {
  vi.useRealTimers()
})

// 1. Happy‑path: single task resolves.
describe("requestQueue – happy path", () => {
  it("resolves a single task", async () => {
    const q = new RequestQueue(baseConfig)
    const result = await q.enqueue(makeThunk("OK"), Date.now(), "one")
    expect(result).toBe("OK")
  })

  it("works with fake timers", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
    })

    let executed = false
    const thunk = () => {
      executed = true
      return Promise.resolve("test")
    }

    const promise = q.enqueue(thunk, Date.now(), "test")

    vi.advanceTimersByTime(0)

    expect(executed).toBe(true)
    await expect(promise).resolves.toBe("test")
  })

  // 调试测试：检查带延迟的任务
  it("works with delayed thunks", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
    })

    let executed = false
    let completed = false
    const delayedThunk = () => {
      executed = true
      return new Promise((resolve) => {
        setTimeout(() => {
          completed = true
          resolve("delayed")
        }, 1000)
      })
    }

    const promise = q.enqueue(delayedThunk, Date.now(), "delayed")

    vi.advanceTimersByTime(0)
    expect(executed).toBe(true)
    expect(completed).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(completed).toBe(true)
    await expect(promise).resolves.toBe("delayed")
  })
})

// 2. Duplicate hash returns same promise instance & value.
describe("requestQueue – de‑duplication", () => {
  it("re‑uses the first task for identical hash", async () => {
    const q = new RequestQueue(baseConfig)

    const p1 = q.enqueue(makeThunk("A"), Date.now(), "dup")
    const p2 = q.enqueue(makeThunk("B"), Date.now(), "dup") // thunk should never run

    // Same promise object (because enqueue now returns duplicateTask.promise directly)
    expect(p1).toBe(p2)

    const [v1, v2] = await Promise.all([p1, p2])
    expect(v1).toBe("A")
    expect(v2).toBe("A")
  })
})

// 3. Token‑bucket rate limiting.
//    capacity = 1, rate = 1 token / sec → tasks should execute at t = 0s, 1s, 2s…
describe("requestQueue – token bucket", () => {
  it("executes tasks no faster than rate permits", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
    })
    const completed: number[] = []

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          completed.push(id)
          resolve(id)
        }, 1000)
      })
    }

    // enqueue 3 tasks immediately, each takes 1000ms to complete
    void q.enqueue(trackingThunk(0), Date.now(), "0")
    void q.enqueue(trackingThunk(1), Date.now(), "1")
    void q.enqueue(trackingThunk(2), Date.now(), "2")

    // t=1000ms: 第一个任务应该完成
    vi.advanceTimersByTime(1_000)

    expect(completed).toEqual([0])

    // t=2000ms: The second task should be completed (started at t=1000ms, completed at t=2000ms)
    vi.advanceTimersByTime(1_000)
    expect(completed).toEqual([0, 1])

    // t=3000ms: The third task should be completed (started at t=2000ms, completed at t=3000ms)
    vi.advanceTimersByTime(1_000)
    expect(completed).toEqual([0, 1, 2])
  })

  it("supports fractional rates below 1 (e.g. 0.25 = one request every 4s)", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
      rate: 0.25,
      capacity: 1,
    })
    const started: string[] = []

    const trackingThunk = (id: string) => () => {
      started.push(id)
      return Promise.resolve(id)
    }

    void q.enqueue(trackingThunk("A"), Date.now(), "A")
    void q.enqueue(trackingThunk("B"), Date.now(), "B")

    // t=0: bucket starts full (1 token) so A dispatches immediately, B waits
    vi.advanceTimersByTime(0)
    expect(started).toEqual(["A"])

    // t=3999ms: still less than 1 token refilled (0.25 tokens/sec)
    vi.advanceTimersByTime(3_999)
    expect(started).toEqual(["A"])

    // t=4000ms: exactly 1 token refilled, B dispatches
    vi.advanceTimersByTime(1)
    expect(started).toEqual(["A", "B"])
  })
})

// 4. scheduleAt in the future should delay execution even when tokens are available.
describe("requestQueue – respects scheduleAt", () => {
  it("delays task until scheduleAt time", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
    })
    const completed: string[] = []

    const trackingThunk = (id: string) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    // Task A scheduled now, task B scheduled 2s later
    const now = Date.now()
    void q.enqueue(trackingThunk("A"), now, "A")
    void q.enqueue(trackingThunk("B"), now + 2000, "B")

    vi.advanceTimersByTime(0)
    expect(completed).toEqual(["A"])

    vi.advanceTimersByTime(1999)
    expect(completed).toEqual(["A"])

    vi.advanceTimersByTime(1)
    expect(completed).toEqual(["A", "B"])
  })
})

// 5. Rejection propagates.
describe("requestQueue – error propagation", () => {
  it("rejects when thunk rejects", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
    })

    const err = new Error("boom")
    const p = q.enqueue(rejectThunk(err, 1000), Date.now(), "err")

    vi.advanceTimersByTime(1000)
    await expect(p).rejects.toBe(err)
  })
})

// 6. High‑volume: 100 tasks should all resolve.
describe("requestQueue – high volume", () => {
  it("drains 100 tasks without starvation or leaks", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      rate: 5,
      capacity: 5,
    }) // 5 / sec
    const count = 100
    const completed: number[] = []

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    for (let i = 0; i < count; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    // Advance time enough: 100 tasks, initial 5 tokens, then 5 per sec
    // First 5 tasks execute immediately, remaining 95 tasks need 95/5 = 19 seconds
    vi.advanceTimersByTime(19_000)
    expect(completed).toHaveLength(count)
  })
})

// 7. Bucket refills after idle period.
describe("requestQueue – bucket refill while idle", () => {
  it("restores capacity when queue sleeps", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      rate: 2,
      capacity: 2,
    })

    const completed: string[] = []
    const trackingThunk = (id: string) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    // Use up both initial tokens
    void q.enqueue(trackingThunk("x"), Date.now(), "x")
    void q.enqueue(trackingThunk("y"), Date.now(), "y")

    vi.advanceTimersByTime(0)
    expect(completed).toEqual(["x", "y"])

    // At this moment bucketTokens == 0. Wait 1500 ms (rate 2/s → add 3 tokens)
    vi.advanceTimersByTime(1500)

    // New task should run immediately because capacity refilled to ≥1
    void q.enqueue(trackingThunk("z"), Date.now(), "z")
    expect(completed).toEqual(["x", "y", "z"])
  })
})

// 8. Timeout handling
describe("requestQueue – timeout handling", () => {
  it("rejects task when it exceeds timeout", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      timeoutMs: 2000,
    })

    // Task that takes 3000ms (longer than 2000ms timeout)
    const slowThunk = () => new Promise((resolve) => setTimeout(resolve, 3000, "too-slow"))

    const promise = q.enqueue(slowThunk, Date.now(), "slow")

    // Advance to timeout
    vi.advanceTimersByTime(2000)

    await expect(promise).rejects.toThrow("Task")
    await expect(promise).rejects.toThrow("timed out after 2000ms")
  })

  it("resolves task when it completes before timeout", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      timeoutMs: 2000,
    })

    // Task that takes 1000ms (less than 2000ms timeout)
    const fastThunk = () => new Promise((resolve) => setTimeout(resolve, 1000, "fast"))

    const promise = q.enqueue(fastThunk, Date.now(), "fast")

    vi.advanceTimersByTime(1000)

    await expect(promise).resolves.toBe("fast")
  })
})

// 8b. Timeout aborts the in-flight attempt
describe("requestQueue – timeout aborts the in-flight attempt", () => {
  it("cancels the timed-out attempt so the retry never runs concurrently", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
      timeoutMs: 1000,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    let running = 0
    let maxConcurrent = 0
    const attemptSignals: (AbortSignal | undefined)[] = []

    const thunk = (signal?: AbortSignal) => {
      const attempt = attemptSignals.push(signal)
      running++
      maxConcurrent = Math.max(maxConcurrent, running)
      return new Promise<string>((resolve, reject) => {
        // first attempt hangs far past the timeout, the retry finishes quickly
        const timer = setTimeout(
          () => {
            running--
            resolve("done")
          },
          attempt === 1 ? 60_000 : 100,
        )
        signal?.addEventListener("abort", () => {
          clearTimeout(timer)
          running--
          reject(signal.reason)
        })
      })
    }

    const promise = q.enqueue(thunk, Date.now(), "abort-on-timeout")

    await vi.advanceTimersByTimeAsync(0)
    expect(running).toBe(1)

    // timeout fires: the attempt must be cancelled before the retry starts
    await vi.advanceTimersByTimeAsync(1000)
    expect(attemptSignals).toHaveLength(1)
    expect(attemptSignals[0]?.aborted).toBe(true)
    expect(running).toBe(0)

    // retry (100ms base delay + jitter) runs alone and succeeds
    await vi.advanceTimersByTimeAsync(500)
    expect(attemptSignals).toHaveLength(2)
    expect(maxConcurrent).toBe(1)
    await expect(promise).resolves.toBe("done")
  })

  it("still rejects with the timeout error when retries are exhausted", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
      timeoutMs: 1000,
      maxRetries: 0,
    })

    let sawAbort = false
    const thunk = (signal?: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        const timer = setTimeout(resolve, 60_000, "too-slow")
        signal?.addEventListener("abort", () => {
          clearTimeout(timer)
          sawAbort = true
          reject(signal.reason)
        })
      })

    const promise = q.enqueue(thunk, Date.now(), "timeout-no-retry")
    promise.catch(() => {})

    await vi.advanceTimersByTimeAsync(1000)

    expect(sawAbort).toBe(true)
    await expect(promise).rejects.toThrow("timed out after 1000ms")
  })

  it("aborts other in-flight attempts when a queue-fatal error drains the backlog", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 2,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const unauthorizedError = Object.assign(new Error("Unauthorized"), {
      statusCode: 401,
    })
    let aborted = false

    const firstPromise = q.enqueue(() => Promise.reject(unauthorizedError), Date.now(), "first")
    firstPromise.catch(() => {})

    const secondPromise = q.enqueue(
      (signal?: AbortSignal) =>
        new Promise((_, reject) => {
          signal?.addEventListener("abort", () => {
            aborted = true
            reject(signal.reason)
          })
        }),
      Date.now(),
      "second",
    )
    secondPromise.catch(() => {})

    await vi.advanceTimersByTimeAsync(0)

    expect(aborted).toBe(true)
    await expect(firstPromise).rejects.toBe(unauthorizedError)
    await expect(secondPromise).rejects.toBe(unauthorizedError)
  })
})

// 9. Retry functionality
describe("requestQueue – retry functionality", () => {
  it("succeeds when retry eventually works", async () => {
    vi.useFakeTimers()
    let attempts = 0

    const q = new RequestQueue({
      ...baseConfig,
      maxRetries: 3,
      baseRetryDelayMs: 100,
    })

    const eventuallySucceedsThunk = () => {
      attempts++
      if (attempts < 2) {
        // Change to succeed on second attempt
        return Promise.reject(new Error(`Attempt ${attempts} failed`))
      }
      return Promise.resolve("success!")
    }

    const promise = q.enqueue(eventuallySucceedsThunk, Date.now(), "eventual-success")

    // Wait for retries to happen
    await vi.advanceTimersByTimeAsync(1000)

    expect(attempts).toBe(2)
    await expect(promise).resolves.toBe("success!")
  })

  it("does not retry when maxRetries is 0", async () => {
    vi.useFakeTimers()
    let attempts = 0

    const q = new RequestQueue({
      ...baseConfig,
      maxRetries: 0,
      baseRetryDelayMs: 100,
    })

    const failingThunk = () => {
      attempts++
      return Promise.reject(new Error("Always fails"))
    }

    const promise = q.enqueue(failingThunk, Date.now(), "no-retry")
    promise.catch(() => {})

    await vi.advanceTimersByTimeAsync(0)
    expect(attempts).toBe(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(attempts).toBe(1) // Still only 1 attempt

    await expect(promise).rejects.toThrow("Always fails")
  })

  it("implements exponential backoff delays", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      maxRetries: 2,
      baseRetryDelayMs: 1000,
    })

    let attempts = 0
    const failingThunk = () => {
      attempts++
      return Promise.reject(new Error("fail"))
    }

    const promise = q.enqueue(failingThunk, Date.now(), "backoff")
    promise.catch(() => {})

    // Initial execution
    await vi.advanceTimersByTimeAsync(0)
    expect(attempts).toBe(1)

    // After 500ms, should not have retried yet (first retry delay is ~1000ms)
    await vi.advanceTimersByTimeAsync(500)
    expect(attempts).toBe(1)

    // After 1200ms total, should have done first retry
    await vi.advanceTimersByTimeAsync(700)
    expect(attempts).toBe(2)

    // After another 1500ms, should not have retried yet (second retry delay is ~2000ms)
    await vi.advanceTimersByTimeAsync(1500)
    expect(attempts).toBe(2)

    // After another 1000ms (total ~3700ms), should have done second retry
    await vi.advanceTimersByTimeAsync(1000)
    expect(attempts).toBe(3)

    await expect(promise).rejects.toThrow("fail")
  })
})

// 10. Retry with timeout combined
describe("requestQueue – retry with timeout combined", () => {
  it("basic timeout functionality works", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
      maxRetries: 0, // No retries for simplicity
      timeoutMs: 100,
    })

    const timeoutThunk = () => {
      // Task takes 200ms, but timeout is 100ms
      return new Promise((resolve) => setTimeout(resolve, 200, "too slow"))
    }

    const promise = q.enqueue(timeoutThunk, Date.now(), "timeout-test")
    promise.catch(() => {})

    // Let the timeout happen
    await vi.advanceTimersByTimeAsync(150)

    // Should reject with timeout error
    await expect(promise).rejects.toThrow("timed out after 100ms")
  })
})

// 11. Retry policy and queue fail-fast drain
describe("requestQueue – retry policy and queue fail-fast drain", () => {
  it.each([
    {
      name: "400",
      createError: () => Object.assign(new Error("Bad Request"), { statusCode: 400 }),
    },
    {
      name: "isRetryable false",
      createError: () => Object.assign(new Error("Do not retry"), { isRetryable: false }),
    },
  ])("fails only the current task for $name", async ({ createError }) => {
    vi.useFakeTimers()
    let attempts = 0

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 1,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const error = createError()
    const completed: string[] = []

    const firstPromise = q.enqueue(
      () => {
        attempts++
        return Promise.reject(error)
      },
      Date.now(),
      "current-only",
    )
    firstPromise.catch(() => {})

    const secondPromise = q.enqueue(
      () => {
        completed.push("second")
        return Promise.resolve("second")
      },
      Date.now(),
      "second",
    )

    await vi.advanceTimersByTimeAsync(100)

    expect(attempts).toBe(1)
    expect(completed).toEqual(["second"])
    await expect(firstPromise).rejects.toBe(error)
    await expect(secondPromise).resolves.toBe("second")
  })

  it("pauses instead of draining the backlog on a 429", async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0) // deterministic pause (no jitter)

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 1,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const completed: string[] = []
    const rateLimitedError = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
    })
    let firstAttempts = 0

    const firstPromise = q.enqueue(
      () => {
        firstAttempts++
        if (firstAttempts === 1) return Promise.reject(rateLimitedError)
        completed.push("first")
        return Promise.resolve("first")
      },
      Date.now(),
      "first",
    )

    const secondPromise = q.enqueue(
      () => {
        completed.push("second")
        return Promise.resolve("second")
      },
      Date.now(),
      "second",
    )

    // 429 lands: nothing rejects, nothing dispatches during the pause window
    await vi.advanceTimersByTimeAsync(4_999)
    expect(completed).toEqual([])
    expect(firstAttempts).toBe(1)

    // Pause (RATE_LIMIT_BASE_PAUSE_MS = 5s) elapses and both complete with
    // zero rejections. The retried task re-queues at the pause end, so the
    // older waiting task dispatches first (FIFO by scheduleAt).
    await vi.advanceTimersByTimeAsync(5_000)
    await expect(firstPromise).resolves.toBe("first")
    await expect(secondPromise).resolves.toBe("second")
    expect(completed).toEqual(["second", "first"])
  })

  it("honors a Retry-After header longer than the base pause", async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0)

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 1,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const rateLimitedError = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
      responseHeaders: {
        "retry-after": "30",
      },
    })
    let attempts = 0

    const promise = q.enqueue(
      () => {
        attempts++
        if (attempts === 1) return Promise.reject(rateLimitedError)
        return Promise.resolve("recovered")
      },
      Date.now(),
      "retry-after",
    )

    await vi.advanceTimersByTimeAsync(29_999)
    expect(attempts).toBe(1)

    await vi.advanceTimersByTimeAsync(1_000)
    await expect(promise).resolves.toBe("recovered")
    expect(attempts).toBe(2)
  })

  it("counts one pause window for concurrent 429s and resets on success", async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0)

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 2,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const rateLimitedError = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
    })
    const attempts = new Map<string, number>()
    const flaky = (hash: string) => () => {
      const n = (attempts.get(hash) ?? 0) + 1
      attempts.set(hash, n)
      return n === 1 ? Promise.reject(rateLimitedError) : Promise.resolve(hash)
    }

    // Both in-flight attempts 429 within the same tick: one pause window.
    const firstPromise = q.enqueue(flaky("first"), Date.now(), "first")
    const secondPromise = q.enqueue(flaky("second"), Date.now(), "second")

    // The first 429 opens a 5s window; the sibling extends it via the doubled
    // backoff (consecutiveRateLimits=1 → 10s) without double-counting.
    await vi.advanceTimersByTimeAsync(10_100)
    await expect(firstPromise).resolves.toBe("first")
    await expect(secondPromise).resolves.toBe("second")

    // Success reset the consecutive counter: a later 429 pauses for the BASE
    // 5s again, not the doubled window.
    const thirdPromise = q.enqueue(flaky("third"), Date.now(), "third")
    await vi.advanceTimersByTimeAsync(4_999)
    expect(attempts.get("third")).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    await expect(thirdPromise).resolves.toBe("third")
  })

  it("fails the whole backlog only after the consecutive pause cap", async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0)

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 1,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const rateLimitedError = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
    })
    let attempts = 0

    const stuckPromise = q.enqueue(
      () => {
        attempts++
        return Promise.reject(rateLimitedError)
      },
      Date.now(),
      "stuck",
    )
    stuckPromise.catch(() => {})

    // Parked far in the future so it stays in the waiting heap the whole time:
    // the drain must reject queued-but-never-dispatched tasks too.
    const waitingPromise = q.enqueue(makeThunk("never"), Date.now() + 999_000, "waiting")
    waitingPromise.catch(() => {})

    // Pause windows escalate 5s, 10s, 20s, 40s, 80s (155s total); the attempt
    // after the fifth window sees consecutiveRateLimits at the cap and drains
    // the whole backlog — the old fail-fast behavior as a backstop.
    await vi.advanceTimersByTimeAsync(160_000)

    expect(attempts).toBe(6)
    await expect(stuckPromise).rejects.toBe(rateLimitedError)
    await expect(waitingPromise).rejects.toBe(rateLimitedError)
  })

  it("cancels a 429-parked task during the pause via cancelByScope", async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0)

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 1,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const rateLimitedError = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
    })
    let attempts = 0

    const promise = q.enqueue(
      () => {
        attempts++
        return Promise.reject(rateLimitedError)
      },
      Date.now(),
      "parked",
      ["tab:session"],
    )
    promise.catch(() => {})

    await vi.advanceTimersByTimeAsync(100)
    expect(attempts).toBe(1)

    // The task sits in the waiting heap until the pause ends — cancelling its
    // scope must drain it like any waiting task.
    expect(q.cancelByScope("tab:session")).toBe(1)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(attempts).toBe(1)
    await expect(promise).rejects.toMatchObject({ name: "TranslationCancelledError" })
  })

  it("ignores drained in-flight failures and allows new enqueues after a queue-fatal error", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 3,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const queueFatalError = Object.assign(new Error("Forbidden"), {
      statusCode: 403,
    })
    const laterError = Object.assign(new Error("Unauthorized"), {
      statusCode: 401,
    })
    const oldDeferred = createDeferred<string>()
    const newDeferred = createDeferred<string>()

    const firstPromise = q.enqueue(() => Promise.reject(queueFatalError), Date.now(), "first")
    firstPromise.catch(() => {})

    const oldPromise = q.enqueue(() => oldDeferred.promise, Date.now(), "old")
    oldPromise.catch(() => {})

    await vi.advanceTimersByTimeAsync(0)
    await expect(oldPromise).rejects.toBe(queueFatalError)

    const newPromise = q.enqueue(() => newDeferred.promise, Date.now(), "new")

    oldDeferred.reject(laterError)
    await vi.advanceTimersByTimeAsync(0)

    newDeferred.resolve("new success")
    await vi.advanceTimersByTimeAsync(0)

    await expect(firstPromise).rejects.toBe(queueFatalError)
    await expect(newPromise).resolves.toBe("new success")
  })

  it("does not let old in-flight task cleanup remove a new task with the same hash", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 3,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const queueFatalError = Object.assign(new Error("Forbidden"), {
      statusCode: 403,
    })
    const oldDeferred = createDeferred<string>()
    const newDeferred = createDeferred<string>()
    let duplicateStarted = false

    const firstPromise = q.enqueue(() => Promise.reject(queueFatalError), Date.now(), "first")
    firstPromise.catch(() => {})

    const oldPromise = q.enqueue(() => oldDeferred.promise, Date.now(), "same")
    oldPromise.catch(() => {})

    await vi.advanceTimersByTimeAsync(0)
    await expect(oldPromise).rejects.toBe(queueFatalError)

    const newPromise = q.enqueue(() => newDeferred.promise, Date.now(), "same")

    oldDeferred.resolve("old success")
    await vi.advanceTimersByTimeAsync(0)

    const duplicatePromise = q.enqueue(
      () => {
        duplicateStarted = true
        return Promise.resolve("duplicate")
      },
      Date.now(),
      "same",
    )

    expect(duplicatePromise).toBe(newPromise)
    expect(duplicateStarted).toBe(false)

    newDeferred.resolve("new success")
    await vi.advanceTimersByTimeAsync(0)

    await expect(firstPromise).rejects.toBe(queueFatalError)
    await expect(newPromise).resolves.toBe("new success")
  })

  it.each([401, 403, 404])("drains the current backlog after a %s", async (statusCode) => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 1,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const completed: string[] = []
    const error = Object.assign(new Error(`HTTP ${statusCode}`), {
      statusCode,
    })

    const firstPromise = q.enqueue(() => Promise.reject(error), Date.now(), "first")
    firstPromise.catch(() => {})

    const secondPromise = q.enqueue(
      () => {
        completed.push("second")
        return Promise.resolve("second")
      },
      Date.now(),
      "second",
    )
    secondPromise.catch(() => {})

    await vi.advanceTimersByTimeAsync(0)

    expect(completed).toEqual([])
    await expect(firstPromise).rejects.toBe(error)
    await expect(secondPromise).rejects.toBe(error)
  })

  it.each([408, 409])("retries transient %s errors before resolving", async (statusCode) => {
    vi.useFakeTimers()
    let attempts = 0

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 1,
      maxRetries: 2,
      baseRetryDelayMs: 100,
    })

    const error = Object.assign(new Error(`HTTP ${statusCode}`), {
      statusCode,
    })

    const promise = q.enqueue(
      () => {
        attempts++
        if (attempts === 1) {
          return Promise.reject(error)
        }
        return Promise.resolve("success")
      },
      Date.now(),
      `transient-${statusCode}`,
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(attempts).toBe(1)

    await vi.advanceTimersByTimeAsync(200)

    expect(attempts).toBe(2)
    await expect(promise).resolves.toBe("success")
  })
})

// 12. Reconfigure the request queue
describe("requestQueue – reconfigure the request queue", () => {
  it("increase the request rate", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      rate: 5,
      capacity: 5,
    }) // 5 / sec
    const count = 50
    const completed: number[] = []

    q.setQueueOptions({ rate: 10 })

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    for (let i = 0; i < count; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    vi.advanceTimersByTime(1_500)
    expect(completed).toHaveLength(20)

    // Advance time enough: 50 tasks, initial 5 tokens, then 10 per sec
    // First 5 tasks execute immediately, remaining 45 tasks need 45/10 = 4.5 seconds
    vi.advanceTimersByTime(3_000)
    expect(completed).toHaveLength(count)
  })

  it("decrease the request rate", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 10,
    }) // 10 / sec
    const count = 40
    const completed: number[] = []

    q.setQueueOptions({ rate: 5 })

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    for (let i = 0; i < count; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    vi.advanceTimersByTime(3_000)
    expect(completed).toHaveLength(25)

    // Advance time enough: 40 tasks, initial 10 tokens, then 5 per sec
    // First 10 tasks execute immediately, remaining 30 tasks need 30/5 = 6 seconds
    vi.advanceTimersByTime(3_000)
    expect(completed).toHaveLength(count)
  })

  it("increase the request capacity without granting a free burst", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      rate: 5,
      capacity: 5,
    }) // 5 / sec
    const count = 50
    const completed: number[] = []

    // Raising capacity must NOT refill the bucket: tokens only accrue via the
    // rate. The bucket still holds the 5 tokens it started with.
    q.setQueueOptions({ capacity: 30 })

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    for (let i = 0; i < count; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    // 5 immediately, then 5/sec: 2s → 5 + 10 = 15
    vi.advanceTimersByTime(2_000)
    expect(completed).toHaveLength(15)

    // Remaining 35 tasks need 35/5 = 7 more seconds
    vi.advanceTimersByTime(7_100)
    expect(completed).toHaveLength(count)
  })

  it("decrease the request capacity", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 10,
    }) // 10/ sec
    const count = 50
    const completed: number[] = []

    q.setQueueOptions({ capacity: 5 })

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    for (let i = 0; i < count; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    vi.advanceTimersByTime(2_000)
    expect(completed).toHaveLength(25)

    // Advance time enough: 50 tasks, initial 5 tokens, then 10 per sec
    // First 5 tasks execute immediately, remaining 45 tasks need 45/10 = 4.5 seconds
    vi.advanceTimersByTime(2_500)
    expect(completed).toHaveLength(count)
  })

  it("update the request queue", async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
      rate: 5,
      capacity: 10,
    })
    const count = 50
    const completed: number[] = []

    q.setQueueOptions({ rate: 10, capacity: 5 })

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    for (let i = 0; i < count; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    // Advance time enough: 50 tasks, initial 5 tokens, then 10 per sec
    // First 5 tasks execute immediately, remaining 45 tasks need 45/10 = 4.5 seconds
    vi.advanceTimersByTime(4_500)
    expect(completed).toHaveLength(count)

    vi.useFakeTimers()

    // The first batch drained the bucket; raising capacity back to 10 does not
    // refill it, so all 50 new tasks are paid for by accrual at 5/sec.
    q.setQueueOptions({ rate: 5, capacity: 10 })

    for (let i = count; i < count * 2; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    vi.advanceTimersByTime(10_100)

    expect(completed).toHaveLength(count * 2)
  })

  it("update rate when handle queue", () => {
    const q = new RequestQueue({ ...baseConfig, rate: 5, capacity: 10 })
    vi.useFakeTimers()
    const count = 50
    const completed: number[] = []

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    const abortIndex = count / 2
    // time = 0 + (25 - 10) / 10 = 1.5
    for (let i = 0; i < abortIndex; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    // Reset rate. All task apply last rate
    q.setQueueOptions({ rate: 10 })

    // time = (50 - 25) / 10 = 2.5
    for (let i = abortIndex; i < count; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    vi.advanceTimersByTime(4_000)

    expect(completed).toHaveLength(count)
  })

  it("update capacity when handle queue", () => {
    const q = new RequestQueue({ ...baseConfig, rate: 5, capacity: 10 })
    vi.useFakeTimers()
    const count = 50
    const completed: number[] = []

    const trackingThunk = (id: number) => () => {
      return new Promise((resolve) => {
        completed.push(id)
        resolve(id)
      })
    }

    const abortIndex = count / 2

    // immediately run 10 tasks (initial bucket)
    for (let i = 0; i < abortIndex; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    // Raising capacity mid-drain does NOT refill the bucket
    q.setQueueOptions({ capacity: 20 })

    for (let i = abortIndex; i < count; i++) {
      void q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    // 10 ran immediately; the remaining 40 accrue at 5/sec = 8 seconds
    vi.advanceTimersByTime(8_100)

    expect(completed).toHaveLength(count)
  })

  it("should throw error when options are invalid", () => {
    const q = new RequestQueue({ ...baseConfig, rate: 5, capacity: 10 })

    expect(() => q.setQueueOptions({ rate: 0, capacity: 0 })).toThrow(/Too small/)

    expect(() => q.setQueueOptions({ rate: -1, capacity: -1 })).toThrow(/Too small/)

    expect(() => q.setQueueOptions({ rate: 0 })).toThrow(/Too small/)

    expect(() => q.setQueueOptions({ capacity: 0 })).toThrow(/Too small/)

    expect(() => q.setQueueOptions({ rate: -1 })).toThrow(/Too small/)

    expect(() => q.setQueueOptions({ capacity: -1 })).toThrow(/Too small/)
  })
})

describe("requestQueue – dispatch ETA and per-task timeout", () => {
  it("nextDispatchEtaMs reflects tokens, backlog depth, and pause", async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0)

    const q = new RequestQueue({ ...baseConfig, rate: 1, capacity: 1 })

    // Fresh queue: full bucket, empty backlog — a new request could go now.
    expect(q.nextDispatchEtaMs()).toBe(0)

    // One in-flight task consumed the only token: next slot in ~1s.
    const hanging = createDeferred<string>()
    const p1 = q.enqueue(() => hanging.promise, Date.now(), "in-flight")
    await vi.advanceTimersByTimeAsync(0)
    expect(q.nextDispatchEtaMs()).toBeGreaterThan(900)
    expect(q.nextDispatchEtaMs()).toBeLessThanOrEqual(1_000)

    // Two more waiting ahead: a NEW request is 3 token-periods away.
    const p2 = q.enqueue(makeThunk("b"), Date.now(), "waiting-1")
    const p3 = q.enqueue(makeThunk("c"), Date.now(), "waiting-2")
    expect(q.nextDispatchEtaMs()).toBeGreaterThan(2_900)
    expect(q.nextDispatchEtaMs()).toBeLessThanOrEqual(3_000)

    hanging.resolve("a")
    await vi.advanceTimersByTimeAsync(3_100)
    await expect(Promise.all([p1, p2, p3])).resolves.toEqual(["a", "b", "c"])
  })

  it("includes the rate-limit pause in the ETA", async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0)

    const q = new RequestQueue({
      ...baseConfig,
      rate: 10,
      capacity: 1,
      maxRetries: 2,
    })

    const rateLimitedError = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
    })
    let attempts = 0
    const promise = q.enqueue(
      () => {
        attempts++
        return attempts === 1 ? Promise.reject(rateLimitedError) : Promise.resolve("ok")
      },
      Date.now(),
      "flaky",
    )

    await vi.advanceTimersByTimeAsync(0)
    // Paused for RATE_LIMIT_BASE_PAUSE_MS with the retry parked in the heap.
    expect(q.nextDispatchEtaMs()).toBeGreaterThan(4_000)

    await vi.advanceTimersByTimeAsync(5_100)
    await expect(promise).resolves.toBe("ok")
  })

  it("per-task timeoutMs override wins over the queue default", async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({ ...baseConfig, timeoutMs: 10_000, maxRetries: 0 })

    const never = createDeferred<string>()
    const promise = q.enqueue(() => never.promise, Date.now(), "slow", undefined, {
      timeoutMs: 500,
    })
    promise.catch(() => {})

    await vi.advanceTimersByTimeAsync(600)
    await expect(promise).rejects.toThrow(/timed out after 500ms/)
  })
})
