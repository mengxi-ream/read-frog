import type { TranslationTask } from './task-queue'
import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'

export interface BatchTask {
  id: string
  tasks: TranslationTask[]
  totalCharacters: number
  langConfig: Config['language']
  providerConfig: ProviderConfig
  scheduleAt: number
  createdAt: number
  retryCount: number
  thunk: () => Promise<string[]>
  promise: Promise<void>
  resolve: (value: void) => void
  reject: (error: Error) => void
}

export interface BatchQueueOptions {
  rate: number // tokens/sec (沿用现有)
  capacity: number // token bucket size (沿用现有)
  timeoutMs: number // 批次超时时间
  maxRetries: number // 批次最大重试次数
  baseRetryDelayMs: number // 重试延迟基数
}

export interface BatchConfig {
  maxCharacters: number // 单个batch最大字符数
  maxDelay: number // 最大等待时间(ms)
  minBatchSize: number // 最小batch大小
}
