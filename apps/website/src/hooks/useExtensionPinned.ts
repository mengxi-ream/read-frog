import { useEffect, useState } from 'react'

export function useExtensionPinned() {
  const [isPinned, setIsPinned] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    function handler(ev: MessageEvent) {
      if (ev.source !== window)
        return
      const { source, type, data } = ev.data || {}
      if (source === 'read-frog-ext' && type === 'pinStateChanged') {
        setIsPinned(!!data.isPinned)
      }
      if (source === 'read-frog-ext' && type === 'getPinState') {
        setIsPinned(!!data.isPinned)
      }
    }

    // init pin state
    window.postMessage({ source: 'read-frog-page', type: 'getPinState' }, '*')

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return isPinned // undefined＝未知，true/false＝已知
}
