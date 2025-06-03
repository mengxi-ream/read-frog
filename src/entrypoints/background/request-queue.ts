import { googleTranslate, microsoftTranslate } from '@/utils/host/translate-text'
import { RequestQueue } from '@/utils/request/request-queue'

export function setUpRequestQueue() {
  const requestQueue = new RequestQueue({
    rate: 2,
    capacity: 3,
    timeoutMs: 10_000,
    maxRetries: 2,
    baseRetryDelayMs: 1000,
  })

  onMessage('enqueueRequest', (message) => {
    const { data } = message

    // Create thunk based on type and params
    let thunk: () => Promise<any>
    switch (data.type) {
      case 'googleTranslate':
        thunk = () => googleTranslate(data.params.text, data.params.fromLang, data.params.toLang)
        break
      case 'microsoftTranslate':
        thunk = () => microsoftTranslate(data.params.text, data.params.fromLang, data.params.toLang)
        break
      default:
        throw new Error(`Unknown request type: ${data.type}`)
    }

    return requestQueue.enqueue(thunk, data.scheduleAt, data.hash)
  })
}
