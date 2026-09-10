import type { SiteRule } from "@/types/config/site-rules"
import { urlMatchesPattern } from "@/utils/url-pattern"

export function urlMatchesRule(
  url: string,
  rule: Pick<SiteRule, "matches" | "excludeMatches">,
): boolean {
  const matches = Array.isArray(rule.matches) ? rule.matches : [rule.matches]
  if (!matches.some((pattern) => urlMatchesPattern(url, pattern))) {
    return false
  }
  return !(rule.excludeMatches ?? []).some((pattern) => urlMatchesPattern(url, pattern))
}
