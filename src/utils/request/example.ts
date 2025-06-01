import type { QueueOptions } from './request'
import { RequestQueue } from './request'

// 配置选项
const queueOptions: QueueOptions = {
  rate: 10, // 每秒10个请求
  capacity: 50, // 令牌桶容量
  maxConcurrency: 5, // 最大并发数
  timeoutMs: 30000, // 30秒超时
  maxRetries: 3, // 最大重试次数
  baseRetryDelayMs: 1000, // 基础重试延迟
}

// 创建请求队列实例
const requestQueue = new RequestQueue(queueOptions)

// 模拟 API 请求函数
async function fetchUserData(userId: string) {
  const response = await fetch(`/api/users/${userId}`)
  return response.json()
}

async function fetchPostData(postId: string) {
  const response = await fetch(`/api/posts/${postId}`)
  return response.json()
}

// 使用示例
async function example() {
  // 示例1：基本使用 - 根据 key 去重
  const userPromise1 = requestQueue.enqueue(
    () => fetchUserData('123'),
    'user:123', // 去重 key
  )

  // 示例2：重复请求 - 将返回同一个 promise
  const userPromise2 = requestQueue.enqueue(
    () => fetchUserData('123'),
    'user:123', // 相同的 key，会复用上面的请求
  )

  // userPromise1 和 userPromise2 实际上是同一个 promise
  const areSame = userPromise1 === userPromise2 // true

  // 示例3：不同的 key，会创建新请求
  const _postPromise = requestQueue.enqueue(
    () => fetchPostData('456'),
    'post:456', // 不同的 key
  )

  // 示例4：检查重复请求
  const hasDuplicate = requestQueue.hasDuplicateRequest('user:123')

  // 示例5：取消请求
  const cancelSuccess = requestQueue.cancelRequest('post:456')

  // 示例6：获取队列状态
  const stats = requestQueue.getStats()

  try {
    const userData = await userPromise1
    // 使用 userData...
    return { userData, areSame, hasDuplicate, cancelSuccess, stats }
  }
  catch (error) {
    console.error('Request failed:', error)
    throw error
  }
}

// Key 生成的最佳实践
export class RequestKeyGenerator {
  // 为用户请求生成 key
  static userKey(userId: string): string {
    return `user:${userId}`
  }

  // 为搜索请求生成 key（包含参数）
  static searchKey(query: string, page: number, limit: number): string {
    return `search:${query}:${page}:${limit}`
  }

  // 为复杂查询生成 key
  static queryKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')
    return `${endpoint}?${sortedParams}`
  }
}

// 更高级的使用示例
async function advancedExample() {
  // 使用 key generator
  const searchPromise = requestQueue.enqueue(
    () => fetch('/api/search?q=typescript&page=1').then(r => r.json()),
    RequestKeyGenerator.searchKey('typescript', 1, 20),
  )

  // 带有复杂参数的请求
  const complexQueryPromise = requestQueue.enqueue(
    () => fetch('/api/complex', {
      method: 'POST',
      body: JSON.stringify({ filter: 'active', sort: 'name' }),
    }).then(r => r.json()),
    RequestKeyGenerator.queryKey('POST:/api/complex', {
      filter: 'active',
      sort: 'name',
    }),
  )

  try {
    const [searchResult, complexResult] = await Promise.all([
      searchPromise,
      complexQueryPromise,
    ])
    return { searchResult, complexResult }
  }
  catch (error) {
    console.error('Advanced example failed:', error)
    throw error
  }
}

export { advancedExample, example }
