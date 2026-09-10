import { useCallback } from "react"
import { getUserSitePatternError, normalizeUserSitePattern } from "@/utils/url-pattern"

/** Why an add did or didn't land, so the caller can tell the user what happened. */
export type AddPatternResult = "added" | "empty" | "duplicate" | "gluedWildcard" | "unsupported"

/**
 * Add and remove helpers for the options pages' URL-pattern lists. Each list lives in a
 * different config field, so persistence stays with the caller and this hook owns the
 * rules every list shares: normalize the input, reject blanks, unmatchable patterns and
 * duplicates, newest first.
 *
 * Normalizing on the way IN is what lets the whole extension run on one matcher. A bare
 * host is stored as `*.host`, which is what the user means by typing a site — the value in
 * the table is then exactly the value that matches, rather than a shorthand the matcher
 * expands behind their back.
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

      // Compared after normalizing, so "example.com" typed twice — or once here
      // and once from the popup toggle — is caught as the duplicate it is.
      const cleanedPattern = normalizeUserSitePattern(pattern)
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
