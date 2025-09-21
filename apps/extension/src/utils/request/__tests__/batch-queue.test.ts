import type { BatchQueueOptions, BatchTask, TranslationTask } from '../types'
import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { executeTranslate } from '@/utils/host/translate/translate-text'

import { BatchQueue } from '../batch-queue'

// Mock provider configs
const mockLLMProvider: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  provider: 'openai',
  enabled: true,
  models: {
    read: {
      model: 'gpt-4o-mini',
      isCustomModel: false,
      customModel: null,
    },
    translate: {
      model: 'gpt-4o-mini',
      isCustomModel: false,
      customModel: null,
    },
  },
  apiKey: 'test-key',
}

const mockTranslateProvider: ProviderConfig = {
  id: 'google',
  name: 'Google Translate',
  provider: 'google',
  enabled: true,
}

const mockLangConfig: Config['language'] = {
  detectedCode: 'eng',
  sourceCode: 'eng',
  targetCode: 'cmn',
  level: 'beginner',
}

// Base configuration for tests
const baseConfig: BatchQueueOptions = {
  rate: 1, // 1 token/sec
  capacity: 1, // bucket size 1
  timeoutMs: 10_000,
  maxRetries: 0,
  baseRetryDelayMs: 100,
}

// Helper function to create a translation task
function createTranslationTask(
  text: string,
  options?: Partial<{
    id: string
    hash: string
    langConfig: Config['language']
    providerConfig: ProviderConfig
    scheduleAt: number
  }>,
): TranslationTask {
  let resolve!: (value: string) => void
  let reject!: (error: Error) => void
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })

  // Add immediate error handler to prevent unhandled promise rejections in tests
  promise.catch(() => {
    // Silently catch to prevent unhandled promise rejection warnings
    // Tests will handle rejections explicitly using Promise.allSettled or .catch()
  })

  return {
    id: options?.id ?? crypto.randomUUID(),
    text,
    hash: options?.hash ?? crypto.randomUUID(),
    langConfig: options?.langConfig ?? mockLangConfig,
    providerConfig: options?.providerConfig ?? mockLLMProvider,
    scheduleAt: options?.scheduleAt ?? Date.now(),
    createdAt: Date.now(),
    resolve,
    reject,
    promise,
  }
}

// Helper function to create a batch task
function createBatchTask(
  tasks: TranslationTask[],
  options?: Partial<{
    id: string
    scheduleAt: number
    retryCount: number
  }>,
): BatchTask {
  return {
    id: options?.id ?? crypto.randomUUID(),
    tasks,
    totalCharacters: tasks.reduce((sum, t) => sum + t.text.length, 0),
    langConfig: tasks[0].langConfig,
    providerConfig: tasks[0].providerConfig,
    scheduleAt: options?.scheduleAt ?? Date.now(),
    createdAt: Date.now(),
    retryCount: options?.retryCount ?? 0,
  }
}

// Mock the executeTranslate function
vi.mock('@/utils/host/translate/translate-text', () => ({
  executeTranslate: vi.fn(),
}))

const mockExecuteTranslate = vi.mocked(executeTranslate)

// Restore timers after each test
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// 1. Happy path: single batch processes successfully
describe('batchQueue – happy path', () => {
  it('processes a single batch successfully', async () => {
    const q = new BatchQueue(baseConfig)
    const task = createTranslationTask('hello')
    const batch = createBatchTask([task])

    mockExecuteTranslate.mockResolvedValueOnce('translated-hello')

    q.enqueue(batch)

    await task.promise
    // For single task, it should be called with batch format
    expect(mockExecuteTranslate).toHaveBeenCalledWith(
      'hello',
      task.langConfig,
      task.providerConfig,
      { isBatch: true },
    )
  })

  it('works with fake timers', async () => {
    vi.useFakeTimers()

    const q = new BatchQueue(baseConfig)
    const task = createTranslationTask('test')
    const batch = createBatchTask([task])

    mockExecuteTranslate.mockResolvedValueOnce('translated-test')

    q.enqueue(batch)

    await vi.advanceTimersByTimeAsync(0)
    await expect(task.promise).resolves.toBe('translated-test')
  })
})

// 2. Token bucket rate limiting
describe('batchQueue – token bucket rate limiting', () => {
  it('executes batches no faster than rate permits', async () => {
    vi.useFakeTimers()

    const q = new BatchQueue({
      ...baseConfig,
      rate: 1, // 1 token/sec
      capacity: 1,
    })

    const completed: number[] = []
    const tasks = Array.from({ length: 3 }, (_, i) => {
      const task = createTranslationTask(`text${i}`)
      void task.promise.then(() => completed.push(i))
      return task
    })

    const batches = tasks.map(task => createBatchTask([task]))

    // Mock slow execution
    mockExecuteTranslate.mockImplementation((text: string) => {
      return new Promise(resolve =>
        setTimeout(() => resolve(`translated-${text}`), 1000),
      )
    })

    // Enqueue all batches immediately
    batches.forEach(batch => q.enqueue(batch))

    // t=1000ms: First batch should complete
    await vi.advanceTimersByTimeAsync(1000)
    expect(completed).toEqual([0])

    // t=2000ms: Second batch should complete (started at t=1000ms)
    await vi.advanceTimersByTimeAsync(1000)
    expect(completed).toEqual([0, 1])

    // t=3000ms: Third batch should complete (started at t=2000ms)
    await vi.advanceTimersByTimeAsync(1000)
    expect(completed).toEqual([0, 1, 2])
  })
})

// 3. Schedule time respect
describe('batchQueue – respects scheduleAt', () => {
  it('delays batch until scheduleAt time', async () => {
    vi.useFakeTimers()

    const q = new BatchQueue(baseConfig)
    const completed: string[] = []

    const taskA = createTranslationTask('A')
    const taskB = createTranslationTask('B')

    void taskA.promise.then(() => completed.push('A'))
    void taskB.promise.then(() => completed.push('B'))

    const now = Date.now()
    const batchA = createBatchTask([taskA], { scheduleAt: now })
    const batchB = createBatchTask([taskB], { scheduleAt: now + 2000 })

    mockExecuteTranslate.mockImplementation((text: string) =>
      Promise.resolve(`translated-${text}`),
    )

    q.enqueue(batchA)
    q.enqueue(batchB)

    await vi.advanceTimersByTimeAsync(0)
    expect(completed).toEqual(['A'])

    await vi.advanceTimersByTimeAsync(1999)
    expect(completed).toEqual(['A'])

    await vi.advanceTimersByTimeAsync(1)
    expect(completed).toEqual(['A', 'B'])
  })
})

// 4. Batch processing for different provider types
describe('batchQueue – batch processing by provider type', () => {
  it('processes LLM batch with batch format', async () => {
    const q = new BatchQueue(baseConfig)
    const tasks = [
      createTranslationTask('hello', { providerConfig: mockLLMProvider }),
      createTranslationTask('world', { providerConfig: mockLLMProvider }),
    ]
    const batch = createBatchTask(tasks)

    mockExecuteTranslate.mockResolvedValueOnce('translated-hello%%translated-world')

    q.enqueue(batch)

    const results = await Promise.all(tasks.map(t => t.promise))
    expect(results).toEqual(['translated-hello', 'translated-world'])
    expect(mockExecuteTranslate).toHaveBeenCalledWith(
      'hello%%world',
      tasks[0].langConfig,
      tasks[0].providerConfig,
      { isBatch: true },
    )
  })

  it('processes non-LLM batch with individual calls', async () => {
    const q = new BatchQueue(baseConfig)
    const tasks = [
      createTranslationTask('hello', { providerConfig: mockTranslateProvider }),
      createTranslationTask('world', { providerConfig: mockTranslateProvider }),
    ]
    const batch = createBatchTask(tasks)

    mockExecuteTranslate
      .mockResolvedValueOnce('translated-hello')
      .mockResolvedValueOnce('translated-world')

    q.enqueue(batch)

    const results = await Promise.all(tasks.map(t => t.promise))
    expect(results).toEqual(['translated-hello', 'translated-world'])
    expect(mockExecuteTranslate).toHaveBeenCalledTimes(2)
    expect(mockExecuteTranslate).toHaveBeenNthCalledWith(1, 'hello', tasks[0].langConfig, tasks[0].providerConfig)
    expect(mockExecuteTranslate).toHaveBeenNthCalledWith(2, 'world', tasks[1].langConfig, tasks[1].providerConfig)
  })
})

// 5. Error handling and rejection
describe('batchQueue – error handling', () => {
  it('rejects all tasks when batch fails', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue(baseConfig)

    const tasks = [
      createTranslationTask('hello'),
      createTranslationTask('world'),
    ]
    const batch = createBatchTask(tasks)

    const error = new Error('Translation failed')
    mockExecuteTranslate.mockRejectedValueOnce(error)

    q.enqueue(batch)

    await vi.advanceTimersByTimeAsync(0)

    // Catch the rejections to avoid unhandled promise rejections
    const results = await Promise.allSettled([tasks[0].promise, tasks[1].promise])
    expect(results[0].status).toBe('rejected')
    expect(results[1].status).toBe('rejected')
    if (results[0].status === 'rejected') {
      expect(results[0].reason).toBe(error)
    }
    if (results[1].status === 'rejected') {
      expect(results[1].reason).toBe(error)
    }
  })

  it('rejects when translation count mismatch occurs', async () => {
    const q = new BatchQueue(baseConfig)
    const tasks = [
      createTranslationTask('hello'),
      createTranslationTask('world'),
    ]
    const batch = createBatchTask(tasks)

    // Return wrong number of results
    mockExecuteTranslate.mockResolvedValueOnce('only-one-result')

    q.enqueue(batch)

    await expect(tasks[0].promise).rejects.toThrow('Translation count mismatch')
    await expect(tasks[1].promise).rejects.toThrow('Translation count mismatch')
  })
})

// 6. Timeout handling
describe('batchQueue – timeout handling', () => {
  it('rejects batch when it exceeds timeout', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue({
      ...baseConfig,
      timeoutMs: 2000,
    })

    const task = createTranslationTask('slow')
    const batch = createBatchTask([task])

    // Simulate slow translation (longer than timeout)
    mockExecuteTranslate.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve('too-slow'), 3000)),
    )

    q.enqueue(batch)

    await vi.advanceTimersByTimeAsync(2000)

    // Catch the rejection to avoid unhandled promise rejection
    const result = await task.promise.catch((err: Error) => err)
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('timed out after 2000ms')
  })

  it('resolves batch when it completes before timeout', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue({
      ...baseConfig,
      timeoutMs: 2000,
    })

    const task = createTranslationTask('fast')
    const batch = createBatchTask([task])

    // Simulate fast translation (less than timeout)
    mockExecuteTranslate.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve('translated-fast'), 1000)),
    )

    q.enqueue(batch)

    await vi.advanceTimersByTimeAsync(1000)

    await expect(task.promise).resolves.toBe('translated-fast')
  })
})

// 7. Retry functionality
describe('batchQueue – retry functionality', () => {
  it('succeeds when retry eventually works', async () => {
    vi.useFakeTimers()
    let attempts = 0

    const q = new BatchQueue({
      ...baseConfig,
      maxRetries: 3,
      baseRetryDelayMs: 100,
    })

    const task = createTranslationTask('retry-test')
    const batch = createBatchTask([task])

    mockExecuteTranslate.mockImplementation(() => {
      attempts++
      if (attempts < 2) {
        return Promise.reject(new Error(`Attempt ${attempts} failed`))
      }
      return Promise.resolve('translated-retry-test')
    })

    q.enqueue(batch)

    // Wait for retries to happen
    await vi.advanceTimersByTimeAsync(1000)

    expect(attempts).toBe(2)
    await expect(task.promise).resolves.toBe('translated-retry-test')
  })

  it('does not retry when maxRetries is 0', async () => {
    vi.useFakeTimers()
    let attempts = 0

    const q = new BatchQueue({
      ...baseConfig,
      maxRetries: 0,
    })

    const task = createTranslationTask('no-retry')
    const batch = createBatchTask([task])

    mockExecuteTranslate.mockImplementation(() => {
      attempts++
      return Promise.reject(new Error('Always fails'))
    })

    q.enqueue(batch)

    await vi.advanceTimersByTimeAsync(1000)
    expect(attempts).toBe(1)

    // Catch the rejection to avoid unhandled promise rejection
    const result = await task.promise.catch((err: Error) => err)
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Always fails')
  })

  it('implements exponential backoff delays', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue({
      ...baseConfig,
      maxRetries: 2,
      baseRetryDelayMs: 1000,
    })

    let attempts = 0
    const task = createTranslationTask('backoff-test')
    const batch = createBatchTask([task])

    mockExecuteTranslate.mockImplementation(() => {
      attempts++
      return Promise.reject(new Error('fail'))
    })

    q.enqueue(batch)

    // Initial execution
    await vi.advanceTimersByTimeAsync(0)
    expect(attempts).toBe(1)

    // After 500ms, should not have retried yet
    await vi.advanceTimersByTimeAsync(500)
    expect(attempts).toBe(1)

    // After 1200ms total, should have done first retry
    await vi.advanceTimersByTimeAsync(700)
    expect(attempts).toBe(2)

    // After another 1500ms, should not have retried yet
    await vi.advanceTimersByTimeAsync(1500)
    expect(attempts).toBe(2)

    // After another 1000ms, should have done second retry
    await vi.advanceTimersByTimeAsync(1000)
    expect(attempts).toBe(3)

    // Catch the rejection to avoid unhandled promise rejection
    const result = await task.promise.catch((err: Error) => err)
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('fail')
  })
})

// 8. High volume processing
describe('batchQueue – high volume', () => {
  it('processes 50 batches without starvation', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue({
      ...baseConfig,
      rate: 5,
      capacity: 5,
    })

    const count = 50
    const completed: number[] = []

    mockExecuteTranslate.mockImplementation((text: string) => {
      const id = Number.parseInt(text.replace('text', ''))
      completed.push(id)
      return Promise.resolve(`translated-${text}`)
    })

    const tasks = Array.from({ length: count }, (_, i) =>
      createTranslationTask(`text${i}`))
    const batches = tasks.map(task => createBatchTask([task]))

    batches.forEach(batch => q.enqueue(batch))

    // First 5 batches execute immediately, remaining 45 need 45/5 = 9 seconds
    await vi.advanceTimersByTimeAsync(9_000)
    expect(completed).toHaveLength(count)
  })
})

// 9. Bucket refill while idle
describe('batchQueue – bucket refill while idle', () => {
  it('restores capacity when queue sleeps', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue({
      ...baseConfig,
      rate: 2,
      capacity: 2,
    })

    const completed: string[] = []

    mockExecuteTranslate.mockImplementation((text: string) => {
      completed.push(text)
      return Promise.resolve(`translated-${text}`)
    })

    // Use up both initial tokens
    const task1 = createTranslationTask('x')
    const task2 = createTranslationTask('y')
    q.enqueue(createBatchTask([task1]))
    q.enqueue(createBatchTask([task2]))

    await vi.advanceTimersByTimeAsync(0)
    expect(completed).toEqual(['x', 'y'])

    // Wait 1500ms (rate 2/s → add 3 tokens)
    await vi.advanceTimersByTimeAsync(1500)

    // New batch should run immediately
    const task3 = createTranslationTask('z')
    q.enqueue(createBatchTask([task3]))
    expect(completed).toEqual(['x', 'y', 'z'])
  })
})

// 10. Queue options reconfiguration
describe('batchQueue – reconfigure options', () => {
  it('increases the processing rate', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue({
      ...baseConfig,
      rate: 5,
      capacity: 5,
    })

    q.setQueueOptions({ rate: 10 })

    const count = 30
    const completed: number[] = []

    mockExecuteTranslate.mockImplementation((text: string) => {
      const id = Number.parseInt(text.replace('text', ''))
      completed.push(id)
      return Promise.resolve(`translated-${text}`)
    })

    const tasks = Array.from({ length: count }, (_, i) =>
      createTranslationTask(`text${i}`))
    const batches = tasks.map(task => createBatchTask([task]))

    batches.forEach(batch => q.enqueue(batch))

    // First 5 execute immediately, remaining 25 need 25/10 = 2.5 seconds
    await vi.advanceTimersByTimeAsync(2_500)
    expect(completed).toHaveLength(count)
  })

  it('increases the capacity', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue({
      ...baseConfig,
      rate: 5,
      capacity: 5,
    })

    q.setQueueOptions({ capacity: 20 })

    const count = 30
    const completed: number[] = []

    mockExecuteTranslate.mockImplementation((text: string) => {
      const id = Number.parseInt(text.replace('text', ''))
      completed.push(id)
      return Promise.resolve(`translated-${text}`)
    })

    const tasks = Array.from({ length: count }, (_, i) =>
      createTranslationTask(`text${i}`))
    const batches = tasks.map(task => createBatchTask([task]))

    batches.forEach(batch => q.enqueue(batch))

    // First 20 execute immediately, remaining 10 need 10/5 = 2 seconds
    await vi.advanceTimersByTimeAsync(2_000)
    expect(completed).toHaveLength(count)
  })

  it('updates multiple options simultaneously', async () => {
    vi.useFakeTimers()
    const q = new BatchQueue({
      ...baseConfig,
      rate: 5,
      capacity: 10,
    })

    q.setQueueOptions({ rate: 10, capacity: 5 })

    const count = 30
    const completed: number[] = []

    mockExecuteTranslate.mockImplementation((text: string) => {
      const id = Number.parseInt(text.replace('text', ''))
      completed.push(id)
      return Promise.resolve(`translated-${text}`)
    })

    const tasks = Array.from({ length: count }, (_, i) =>
      createTranslationTask(`text${i}`))
    const batches = tasks.map(task => createBatchTask([task]))

    batches.forEach(batch => q.enqueue(batch))

    // First 5 execute immediately, remaining 25 need 25/10 = 2.5 seconds
    await vi.advanceTimersByTimeAsync(2_500)
    expect(completed).toHaveLength(count)
  })
})
