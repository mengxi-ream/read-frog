export interface ProxyResponse {
  status: number
  statusText: string
  headers: [string, string][]
  body: string
}

export interface CacheConfig {
  enabled: boolean
  groupKey: string
  ttl?: number
  maxSize?: number
}

export interface ProxyRequest {
  url: string
  method?: string
  headers?: [string, string][]
  body?: string
  credentials?: "omit" | "same-origin" | "include"
  cacheConfig?: CacheConfig
}
