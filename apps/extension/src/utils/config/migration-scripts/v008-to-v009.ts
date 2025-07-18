import { DEFAULT_REQUEST_CAPACITY, DEFAULT_REQUEST_RATE } from '@/utils/constants/translate'

export function migrate(oldConfig: any): any {
  // Expose request queue rate parameters
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      requestQueueConfig: {
        capacity: DEFAULT_REQUEST_CAPACITY,
        rate: DEFAULT_REQUEST_RATE,
      },
    },

  }
}
