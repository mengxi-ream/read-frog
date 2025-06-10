import type { LangCodeISO6393 } from '@/types/languages'
import { useEffect, useState } from 'react'

export function useGetTargetLanguage() {
  const [targetLanguage, setTargetLanguage] = useState<
    LangCodeISO6393 | undefined
  >(undefined)

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout
    const maxRetries = 3
    let retryCount = 0

    const sendMessage = () => {
      window.postMessage(
        {
          source: 'read-frog-page',
          type: 'getTargetLanguage',
        },
        '*',
      )

      if (retryCount < maxRetries) {
        retryCount++
        retryTimeout = setTimeout(sendMessage, 1000) // Retry after 1 second
      }
    }

    const messageHandler = (ev: MessageEvent) => {
      if (ev.source !== window)
        return
      const { source, type, data } = ev.data || {}
      if (source === 'read-frog-ext' && type === 'getTargetLanguage') {
        clearTimeout(retryTimeout) // Clear retry timeout when we get a response
        setTargetLanguage(data.targetLanguage)
      }
    }

    window.addEventListener('message', messageHandler)
    sendMessage() // Initial send

    return () => {
      window.removeEventListener('message', messageHandler)
      clearTimeout(retryTimeout)
    }
  }, [])

  return targetLanguage
}
