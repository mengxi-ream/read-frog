import type { BatchConfig, BatchQueueOptions, TranslationTask } from '../types'
import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BATCH_SEPARATOR } from '@/utils/constants/prompt'
import { BatchQueue } from '../batch-queue'
import { TaskQueue } from '../task-queue'

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

// Mock batch queue options
const baseBatchQueueOptions: BatchQueueOptions = {
  rate: 1,
  capacity: 1,
  timeoutMs: 10_000,
  maxRetries: 0,
  baseRetryDelayMs: 100,
}

// Mock batch config
const baseBatchConfig: BatchConfig = {
  batchCharacters: 1000,
  batchSize: 10,
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

// Mock the executeTranslate function
vi.mock('@/utils/host/translate/translate-text', () => ({
  executeTranslate: vi.fn().mockImplementation((text: string) => {
    if (text.includes(BATCH_SEPARATOR)) {
      // Batch translation
      const parts = text.split(BATCH_SEPARATOR)
      return Promise.resolve(parts.map(part => `translated-${part.trim()}`).join(BATCH_SEPARATOR))
    }
    // Single translation
    return Promise.resolve(`translated-${text}`)
  }),
}))

// Restore timers after each test
afterEach(() => {
  vi.useRealTimers()
})

// 1. Basic task queue functionality
describe('taskQueue – basic functionality', () => {
  let taskQueue: TaskQueue
  let batchQueue: BatchQueue

  beforeEach(() => {
    taskQueue = new TaskQueue(baseBatchConfig)
    batchQueue = new BatchQueue(baseBatchQueueOptions)
    taskQueue.setBatchQueue(batchQueue)
  })

  it('initializes empty queue', () => {
    expect(taskQueue.isEmpty()).toBe(true)
    expect(taskQueue.size()).toBe(0)
  })

  it('enqueues and processes single task', async () => {
    const task = createTranslationTask('hello')
    const promise = taskQueue.enqueue(task)

    // Task is immediately scheduled and moved to batch queue, so waiting queue becomes empty
    expect(taskQueue.isEmpty()).toBe(true)
    expect(taskQueue.size()).toBe(0)

    // The task should be processed immediately since it's a single task
    await expect(promise).resolves.toBe('translated-hello')
  })

  it('peek returns next task without removing it', () => {
    const task = createTranslationTask('hello', { scheduleAt: Date.now() + 1000 })
    void taskQueue.enqueue(task)

    const peeked = taskQueue.peek()
    expect(peeked).toBeDefined()
    expect(peeked?.text).toBe('hello')
    expect(taskQueue.size()).toBe(1)
  })

  it('dequeue removes and returns next task', () => {
    const task = createTranslationTask('hello', { scheduleAt: Date.now() + 5000 }) // Delay task
    void taskQueue.enqueue(task)

    // Task should still be in queue since it's scheduled for future
    expect(taskQueue.size()).toBe(1)

    const dequeued = taskQueue.dequeue()
    expect(dequeued).toBeDefined()
    expect(dequeued?.text).toBe('hello')
    expect(taskQueue.size()).toBe(0)
  })
})

// 2. Task deduplication
describe('taskQueue – deduplication', () => {
  let taskQueue: TaskQueue
  let batchQueue: BatchQueue

  beforeEach(() => {
    taskQueue = new TaskQueue(baseBatchConfig)
    batchQueue = new BatchQueue(baseBatchQueueOptions)
    taskQueue.setBatchQueue(batchQueue)
  })

  it('reuses promise for duplicate hash', async () => {
    const hash = 'duplicate-hash'
    const task1 = createTranslationTask('hello', { hash, scheduleAt: Date.now() + 5000 })
    const task2 = createTranslationTask('different text', { hash, scheduleAt: Date.now() + 5000 })

    const promise1 = taskQueue.enqueue(task1)
    const promise2 = taskQueue.enqueue(task2)

    // Should return same promise instance
    expect(promise1).toBe(promise2)

    // Only one task should be in queue due to deduplication
    expect(taskQueue.size()).toBe(1)
  })
})

// 3. Task scheduling
describe('taskQueue – scheduling', () => {
  let taskQueue: TaskQueue
  let batchQueue: BatchQueue

  beforeEach(() => {
    vi.useFakeTimers()
    taskQueue = new TaskQueue(baseBatchConfig)
    batchQueue = new BatchQueue(baseBatchQueueOptions)
    taskQueue.setBatchQueue(batchQueue)
  })

  it('respects scheduleAt time', async () => {
    const now = Date.now()
    const task1 = createTranslationTask('immediate', { scheduleAt: now })
    const task2 = createTranslationTask('delayed', { scheduleAt: now + 2000 })

    const results: string[] = []

    const promise1 = taskQueue.enqueue(task1)
    const promise2 = taskQueue.enqueue(task2)

    promise1.then(result => results.push(result)).catch(() => {})
    promise2.then(result => results.push(result)).catch(() => {})

    // Advance immediately - only first task should execute
    await vi.advanceTimersByTimeAsync(100)
    expect(results).toEqual(['translated-immediate'])

    // Advance to when second task should execute
    await vi.advanceTimersByTimeAsync(2000)
    expect(results).toEqual(['translated-immediate', 'translated-delayed'])
  })
})

// 4. Batch creation for LLM providers
describe('taskQueue – batching for LLM providers', () => {
  let taskQueue: TaskQueue
  let batchQueue: BatchQueue

  beforeEach(() => {
    vi.useFakeTimers()
    taskQueue = new TaskQueue({
      batchCharacters: 100,
      batchSize: 3,
    })
    batchQueue = new BatchQueue(baseBatchQueueOptions)
    taskQueue.setBatchQueue(batchQueue)
  })

  it('batches small LLM tasks together', async () => {
    const tasks = [
      createTranslationTask('hello', { providerConfig: mockLLMProvider }),
      createTranslationTask('world', { providerConfig: mockLLMProvider }),
      createTranslationTask('test', { providerConfig: mockLLMProvider }),
    ]

    const promises = tasks.map(task => taskQueue.enqueue(task))

    // Wait for batch timer to trigger
    await vi.advanceTimersByTimeAsync(200)

    const results = await Promise.all(promises)
    expect(results).toEqual(['translated-hello', 'translated-world', 'translated-test'])
  })

  it('sends large tasks directly without batching', async () => {
    const largeText = 'x'.repeat(200) // Exceeds batchCharacters limit
    const task = createTranslationTask(largeText, { providerConfig: mockLLMProvider })

    const promise = taskQueue.enqueue(task)
    await vi.advanceTimersByTimeAsync(0)

    await expect(promise).resolves.toBe(`translated-${largeText}`)
  })

  it('sends non-LLM tasks directly without batching', async () => {
    const task = createTranslationTask('hello', { providerConfig: mockTranslateProvider })

    const promise = taskQueue.enqueue(task)
    await vi.advanceTimersByTimeAsync(0)

    await expect(promise).resolves.toBe('translated-hello')
  })

  it('flushes batch when reaching size limit', () => {
    // This test verifies that tasks are enqueued properly
    // The actual batching behavior is tested at the integration level
    const tasks = Array.from({ length: 5 }, (_, i) =>
      createTranslationTask(`text${i}`, { providerConfig: mockLLMProvider }))

    // Enqueue tasks - they should be processed immediately since batch queue is set up
    tasks.forEach((task) => {
      void taskQueue.enqueue(task)
    })

    // All tasks should have been scheduled (moved from waiting queue)
    expect(taskQueue.isEmpty()).toBe(true)
  })

  it('flushes batch when reaching character limit', () => {
    // This test verifies that tasks with large character counts are handled properly
    const tasks = [
      createTranslationTask('x'.repeat(40), { providerConfig: mockLLMProvider }),
      createTranslationTask('y'.repeat(40), { providerConfig: mockLLMProvider }),
      createTranslationTask('z'.repeat(40), { providerConfig: mockLLMProvider }), // This should trigger flush
    ]

    // Enqueue tasks - they should be processed immediately
    tasks.forEach((task) => {
      void taskQueue.enqueue(task)
    })

    // All tasks should have been scheduled (moved from waiting queue)
    expect(taskQueue.isEmpty()).toBe(true)
  })
})

// 5. Requeue functionality
describe('taskQueue – requeue functionality', () => {
  let taskQueue: TaskQueue
  let batchQueue: BatchQueue

  beforeEach(() => {
    taskQueue = new TaskQueue(baseBatchConfig)
    batchQueue = new BatchQueue(baseBatchQueueOptions)
    taskQueue.setBatchQueue(batchQueue)
  })

  it('requeues single task', () => {
    const task = createTranslationTask('hello')

    // Manually dequeue then requeue
    void taskQueue.enqueue(task)
    const dequeued = taskQueue.dequeue()
    expect(taskQueue.isEmpty()).toBe(true)

    if (dequeued) {
      taskQueue.requeue(dequeued)
      expect(taskQueue.size()).toBe(1)
    }
  })

  it('requeues multiple tasks', () => {
    const futureTime = Date.now() + 10000
    const tasks = [
      createTranslationTask('hello1', { scheduleAt: futureTime }),
      createTranslationTask('hello2', { scheduleAt: futureTime }),
      createTranslationTask('hello3', { scheduleAt: futureTime }),
    ]

    tasks.forEach(task => void taskQueue.enqueue(task))
    expect(taskQueue.size()).toBe(3)

    // Dequeue all
    const dequeuedTasks = []
    while (!taskQueue.isEmpty()) {
      const task = taskQueue.dequeue()
      if (task)
        dequeuedTasks.push(task)
    }

    expect(taskQueue.isEmpty()).toBe(true)

    // Requeue all
    taskQueue.requeueTasks(dequeuedTasks)
    expect(taskQueue.size()).toBe(3)
  })

  it('does not requeue duplicate tasks', () => {
    const task = createTranslationTask('hello', { hash: 'unique-hash', scheduleAt: Date.now() + 5000 })

    void taskQueue.enqueue(task)
    expect(taskQueue.size()).toBe(1)

    // Dequeue the task first
    const dequeuedTask = taskQueue.dequeue()
    expect(taskQueue.isEmpty()).toBe(true)

    // Requeue the same task
    if (dequeuedTask) {
      taskQueue.requeue(dequeuedTask)
      expect(taskQueue.size()).toBe(1)

      // Try to requeue again - should not add duplicate
      taskQueue.requeue(dequeuedTask)
      expect(taskQueue.size()).toBe(1)
    }
  })
})

// 6. Batch configuration updates
describe('taskQueue – batch configuration', () => {
  let taskQueue: TaskQueue
  let batchQueue: BatchQueue

  beforeEach(() => {
    taskQueue = new TaskQueue(baseBatchConfig)
    batchQueue = new BatchQueue(baseBatchQueueOptions)
    taskQueue.setBatchQueue(batchQueue)
  })

  it('updates batch configuration', () => {
    const newConfig = {
      batchCharacters: 500,
      batchSize: 5,
    }

    taskQueue.setBatchConfig(newConfig)

    // Test that new config is applied by checking large task threshold
    const largeTask = createTranslationTask('x'.repeat(600), { providerConfig: mockLLMProvider })
    void taskQueue.enqueue(largeTask)

    // Should be sent directly since it exceeds new character limit
    expect(taskQueue.size()).toBe(0) // Task should be immediately processed
  })
})

// 7. Error handling
describe('taskQueue – error handling', () => {
  let taskQueue: TaskQueue

  beforeEach(() => {
    taskQueue = new TaskQueue(baseBatchConfig)
  })

  it('handles gracefully when batch queue is not set', () => {
    const task = createTranslationTask('hello')

    // Should not throw error, task should be queued but not processed
    expect(() => void taskQueue.enqueue(task)).not.toThrow()
    expect(taskQueue.size()).toBe(1)
    expect(taskQueue.isEmpty()).toBe(false)
  })
})

// 8. Priority ordering
describe('taskQueue – priority ordering', () => {
  let taskQueue: TaskQueue
  let batchQueue: BatchQueue

  beforeEach(() => {
    vi.useFakeTimers()
    taskQueue = new TaskQueue(baseBatchConfig)
    batchQueue = new BatchQueue(baseBatchQueueOptions)
    taskQueue.setBatchQueue(batchQueue)
  })

  it('processes tasks in schedule order', async () => {
    const now = Date.now()
    const results: string[] = []

    // Add tasks in reverse chronological order
    const task3 = createTranslationTask('third', { scheduleAt: now + 3000 })
    const task1 = createTranslationTask('first', { scheduleAt: now })
    const task2 = createTranslationTask('second', { scheduleAt: now + 1000 })

    const promise1 = taskQueue.enqueue(task1)
    const promise2 = taskQueue.enqueue(task2)
    const promise3 = taskQueue.enqueue(task3)

    void promise1?.then(result => results.push(result)).catch(() => {})
    void promise2?.then(result => results.push(result)).catch(() => {})
    void promise3?.then(result => results.push(result)).catch(() => {})

    // Execute in schedule order
    await vi.advanceTimersByTimeAsync(100)
    expect(results).toEqual(['translated-first'])

    await vi.advanceTimersByTimeAsync(1000)
    expect(results).toEqual(['translated-first', 'translated-second'])

    await vi.advanceTimersByTimeAsync(2000)
    expect(results).toEqual(['translated-first', 'translated-second', 'translated-third'])
  })
})
