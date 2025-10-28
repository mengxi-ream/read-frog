/**
 * Custom hook for debouncing values
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced value
 */

import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timeoutId)
  }, [value, delay])

  return debouncedValue
}
