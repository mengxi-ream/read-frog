import { useEffect, useRef, useState } from "react"

interface DelayedTruthyState {
  delay: number
  key: unknown
}

function isSameDelayedTruthyState(
  state: DelayedTruthyState | null,
  expectedState: DelayedTruthyState,
) {
  return state !== null
    && state.delay === expectedState.delay
    && Object.is(state.key, expectedState.key)
}

export function useDelayedTruthy(value: boolean, delay: number, resetKey: unknown) {
  const isMountedRef = useRef(false)
  const [readyState, setReadyState] = useState<DelayedTruthyState | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!value) {
      return
    }

    const scheduledState = { delay, key: resetKey }
    const timeoutId = setTimeout(() => {
      setReadyState(scheduledState)
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      queueMicrotask(() => {
        if (!isMountedRef.current) {
          return
        }

        setReadyState(currentState =>
          isSameDelayedTruthyState(currentState, scheduledState) ? null : currentState,
        )
      })
    }
  }, [delay, resetKey, value])

  return value
    && isSameDelayedTruthyState(readyState, { delay, key: resetKey })
}
