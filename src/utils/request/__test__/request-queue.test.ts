import { describe, it, vi } from 'vitest'
import { RequestQueue } from '../request-queue'

// Convenience helper: returns a thunk that resolves with <value>
// after <delayMs> real / fake milliseconds.
function makeThunk<T>(value: T, delayMs = 0) {
  return () =>
    new Promise<T>(res => setTimeout(() => res(value), delayMs))
}

// rejectThunk – rejects after delayMs
function rejectThunk(error: any, delayMs = 0) {
  return () =>
    new Promise((_, rej) => setTimeout(() => rej(error), delayMs))
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
describe('requestQueue – happy path', () => {
  it('resolves a single task', async () => {
    const q = new RequestQueue(baseConfig)
    const result = await q.enqueue(makeThunk('OK'), Date.now(), 'one')
    expect(result).toBe('OK')
  })

  it('works with fake timers', async () => {
    vi.useFakeTimers()

    const q = new RequestQueue({
      ...baseConfig,
    })

    let executed = false
    const thunk = () => {
      executed = true
      return Promise.resolve('test')
    }

    const promise = q.enqueue(thunk, Date.now(), 'test')

    vi.advanceTimersByTime(0)

    expect(executed).toBe(true)
    await expect(promise).resolves.toBe('test')
  })

  // 调试测试：检查带延迟的任务
  it('works with delayed thunks', async () => {
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
          resolve('delayed')
        }, 1000)
      })
    }

    const promise = q.enqueue(delayedThunk, Date.now(), 'delayed')

    vi.advanceTimersByTime(0)
    expect(executed).toBe(true)
    expect(completed).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(completed).toBe(true)
    await expect(promise).resolves.toBe('delayed')
  })
})

// 2. Duplicate hash returns same promise instance & value.
describe('requestQueue – de‑duplication', () => {
  it('re‑uses the first task for identical hash', async () => {
    const q = new RequestQueue(baseConfig)

    const p1 = q.enqueue(makeThunk('A'), Date.now(), 'dup')
    const p2 = q.enqueue(makeThunk('B'), Date.now(), 'dup') // thunk should never run

    // Same promise object (because enqueue now returns duplicateTask.promise directly)
    expect(p1).toBe(p2)

    const [v1, v2] = await Promise.all([p1, p2])
    expect(v1).toBe('A')
    expect(v2).toBe('A')
  })
})

// 3. Token‑bucket rate limiting.
//    capacity = 1, rate = 1 token / sec → tasks should execute at t = 0s, 1s, 2s…
describe('requestQueue – token bucket', () => {
  it('executes tasks no faster than rate permits', async () => {
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
    q.enqueue(trackingThunk(0), Date.now(), '0')
    q.enqueue(trackingThunk(1), Date.now(), '1')
    q.enqueue(trackingThunk(2), Date.now(), '2')

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
})

// 4. scheduleAt in the future should delay execution even when tokens are available.
describe('requestQueue – respects scheduleAt', () => {
  it('delays task until scheduleAt time', async () => {
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
    q.enqueue(trackingThunk('A'), now, 'A')
    q.enqueue(trackingThunk('B'), now + 2000, 'B')

    vi.advanceTimersByTime(0)
    expect(completed).toEqual(['A'])

    vi.advanceTimersByTime(1999)
    expect(completed).toEqual(['A'])

    vi.advanceTimersByTime(1)
    expect(completed).toEqual(['A', 'B'])
  })
})

// 5. Rejection propagates.
describe('requestQueue – error propagation', () => {
  it('rejects when thunk rejects', async () => {
    vi.useFakeTimers()
    const q = new RequestQueue({
      ...baseConfig,
    })

    const err = new Error('boom')
    const p = q.enqueue(rejectThunk(err, 1000), Date.now(), 'err')

    vi.advanceTimersByTime(1000)
    await expect(p).rejects.toBe(err)
  })
})

// 6. High‑volume: 100 tasks should all resolve.
describe('requestQueue – high volume', () => {
  it('drains 100 tasks without starvation or leaks', async () => {
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
      q.enqueue(trackingThunk(i), Date.now(), `task-${i}`)
    }

    // Advance time enough: 100 tasks, initial 5 tokens, then 5 per sec
    // First 5 tasks execute immediately, remaining 95 tasks need 95/5 = 19 seconds
    vi.advanceTimersByTime(19_000)
    await Promise.resolve()
    expect(completed).toHaveLength(count)
  })
})

// 7. Bucket refills after idle period.
describe('requestQueue – bucket refill while idle', () => {
  it('restores capacity when queue sleeps', async () => {
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
    q.enqueue(trackingThunk('x'), Date.now(), 'x')
    q.enqueue(trackingThunk('y'), Date.now(), 'y')

    vi.advanceTimersByTime(0)
    expect(completed).toEqual(['x', 'y'])

    // At this moment bucketTokens == 0. Wait 1500 ms (rate 2/s → add 3 tokens)
    vi.advanceTimersByTime(1500)

    // New task should run immediately because capacity refilled to ≥1
    q.enqueue(trackingThunk('z'), Date.now(), 'z')
    expect(completed).toEqual(['x', 'y', 'z'])
  })
})
