import { DEFAULT_REQUEST_CAPACITY, DEFAULT_REQUEST_RATE, REQUEST_RATE_EXPOSE_PROPERTIES } from '@/utils/constants/translate'

export function migrate(oldConfig: any): any {
  // 暴露请求队列速率参数
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      requestQueueConfig: {
        [REQUEST_RATE_EXPOSE_PROPERTIES.Capacity]: DEFAULT_REQUEST_CAPACITY,
        [REQUEST_RATE_EXPOSE_PROPERTIES.Rate]: DEFAULT_REQUEST_RATE,
      },
    },

  }
}
