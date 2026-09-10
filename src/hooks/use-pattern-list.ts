import { useCallback } from "react"
import { getUserSitePatternError } from "@/utils/url-pattern"

/** Why an add did or didn't land, so the caller can tell the user what happened. */
export type AddPatternResult = "added" | "empty" | "duplicate" | "gluedWildcard" | "unsupported"

/**
 * Add and remove helpers for the options pages' URL-pattern lists. Each list lives in a
 * different config field, so persistence stays with the caller and this hook owns the
 * rules every list shares: trim the input, reject blanks, unmatchable patterns and
 * duplicates, newest first.
 *
 * A typed pattern is stored EXACTLY as typed. `example.com` is valid match-pattern syntax
 * meaning that exact host, and quietly widening it to `*.example.com` would be answering a
 * question the user did not ask — the row would then not say what they wrote. The popup's
 * per-site toggles are the other case, where the extension picks the pattern itself and
 * `sitePatternForHost` does expand it.
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
      const error = getUserSitePatternError(pattern)
      if (error) return error

      const cleanedPattern = pattern.trim()
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
