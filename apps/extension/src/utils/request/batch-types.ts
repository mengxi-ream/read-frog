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
  thunk?: () => Promise<string[]>
}

export interface BatchQueueOptions {
  rate: number // tokens/sec
  capacity: number // token bucket size
  timeoutMs: number // batch timeout
  maxRetries: number // max retry count
  baseRetryDelayMs: number // base retry delay
}

export interface BatchConfig {
  batchCharacters: number // max characters per batch
  batchSize: number // max batch size
}
