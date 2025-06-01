import type { FastPriorityQueue } from 'fastpriorityqueue'

export interface RequestTask {
  id: string
  key: string
  promise: Promise<any>
  activeAt: number
  createdAt: number
}

export interface QueueOptions {
  rate: number // tokens/sec
  capacity: number // token bucket size
  maxConcurrency: number // max concurrent requests
  timeoutMs: number
  maxRetries: number
  baseRetryDelayMs: number
}

export class RequestQueue {
  private queue: FastPriorityQueue<RequestTask>
  private activeTasks = new Map<string, RequestTask>() // key -> task mapping for O(1) lookup
  private keyToPromise = new Map<string, Promise<any>>() // key -> promise mapping for deduplication
  private runningCount = 0

  // token bucket
  private bucketTokens: number
  private lastRefill: number

  constructor(private options: QueueOptions) {
    this.options = options
    this.bucketTokens = options.capacity
    this.lastRefill = Date.now()
  }

  enqueue<T>(requestFn: () => Promise<T>, key: string): Promise<T> {
    if (this.keyToPromise.has(key)) {
      // TODO: handle if the same key but different requestFn
      return this.keyToPromise.get(key) as Promise<T>
    }

    // 创建原始 promise
    const originalPromise = requestFn()

    // 使用 finally 确保清理逻辑在所有用户代码完成后执行
    const promiseWithCleanup = originalPromise
      .finally(() => {
        // 无论成功失败都要清理
        this.handleTaskComplete(key)
      })

    const task: RequestTask = {
      id: crypto.randomUUID(),
      key,
      promise: originalPromise,
      createdAt: Date.now(),
    }

    // 添加到映射表
    this.activeTasks.set(key, task)
    this.keyToPromise.set(key, promiseWithCleanup)

    // 添加到队列
    this.queue.push(task)

    this.processQueue()
    return promiseWithCleanup
  }

  private handleTaskComplete(key: string) {
    // 清理映射表
    this.activeTasks.delete(key)
    this.keyToPromise.delete(key)
    this.runningCount--

    // 继续处理队列
    this.processQueue()
  }

  private processQueue() {
    if (this.runningCount >= this.options.maxConcurrency) {
      return
    }

    this.refillTokens()

    if (this.bucketTokens < 1) {
      return
    }

    const task = this.queue.shift()
    if (!task) {
      return
    }

    this.bucketTokens--
    this.runningCount++
  }

  /**
   * 检查是否存在重复请求 - O(1) 时间复杂度
   */
  hasDuplicateRequest(key: string): boolean {
    return this.keyToPromise.has(key)
  }

  /**
   * 取消特定 key 的请求
   */
  cancelRequest(key: string): boolean {
    const task = this.activeTasks.get(key)
    if (!task) {
      return false
    }

    // 从队列中移除
    const queueIndex = this.queue.findIndex(t => t.key === key)
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1)
    }

    // 清理映射表
    this.activeTasks.delete(key)
    this.keyToPromise.delete(key)

    // 注意：我们无法真正"取消"已经开始的 Promise
    // 这里只是从队列中移除，实际的网络请求可能仍在进行

    return true
  }

  /**
   * 获取队列状态
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeTasks.size,
      runningCount: this.runningCount,
      bucketTokens: this.bucketTokens,
    }
  }

  private refillTokens() {
    const now = Date.now()
    const timeSinceLastRefill = now - this.lastRefill
    const tokensToAdd = (timeSinceLastRefill / 1000) * this.options.rate
    this.bucketTokens = Math.min(this.bucketTokens + tokensToAdd, this.options.capacity)
    this.lastRefill = now
  }
}
