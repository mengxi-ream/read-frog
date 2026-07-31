import { useCallback } from "react"

/** Why an add did or didn't land, so the caller can tell the user what happened. */
export type AddPatternResult = "added" | "empty" | "duplicate"

/**
 * Add and remove helpers for the options pages' URL-pattern lists. Each list lives in a
 * different config field, so persistence stays with the caller and this hook owns the
 * rules every list shares: trim the input, reject blanks and duplicates, newest first.
 */
export function usePatternList(
  patterns: string[],
  onChange: (nextPatterns: string[]) => void,
): {
  addPattern: (pattern: string) => AddPatternResult
  removePattern: (pattern: string) => void
} {
  const addPattern = useCallback(
    (pattern: string): AddPatternResult => {
      const cleanedPattern = pattern.trim()
      if (!cleanedPattern) return "empty"
      if (patterns.includes(cleanedPattern)) return "duplicate"

      onChange([cleanedPattern, ...patterns])
      return "added"
    },
    [patterns, onChange],
  )

  const removePattern = useCallback(
    (pattern: string) => {
      onChange(patterns.filter((existing) => existing !== pattern))
    },
    [patterns, onChange],
  )

  return { addPattern, removePattern }
}
