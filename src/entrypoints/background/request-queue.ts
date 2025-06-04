import { aiTranslate, googleTranslate, microsoftTranslate } from '@/utils/host/translate/api'
import { RequestQueue } from '@/utils/request/request-queue'

export function setUpRequestQueue() {
  const requestQueue = new RequestQueue({
    rate: 5,
    capacity: 300,
    timeoutMs: 20_000,
    maxRetries: 2,
    baseRetryDelayMs: 1_000,
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
      case 'aiTranslate':
        thunk = () => aiTranslate(data.params.provider, data.params.modelString, data.params.prompt)
        break
      default:
        throw new Error(`Unknown request type: ${data.type}`)
    }

    return requestQueue.enqueue(thunk, data.scheduleAt, data.hash)
  })
}
