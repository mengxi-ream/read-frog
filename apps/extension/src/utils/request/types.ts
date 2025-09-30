export interface BatchQueueOptions {
  rate: number // tokens/sec
  capacity: number // token bucket size
  timeoutMs: number // batch timeout
  maxRetries: number // max retry count
  baseRetryDelayMs: number // base retry delay
}

export interface BatchConfig {
  maxCharactersPerBatch: number // max characters per batch
  maxItemsPerBatch: number // max batch size
}
