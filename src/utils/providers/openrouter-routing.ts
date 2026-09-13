import type { OpenRouterProviderSpecificSettings } from "@/types/config/provider"

/**
 * The subset of OpenRouter's `provider` routing object this app sets. Field names are
 * OpenRouter's own — see https://openrouter.ai/docs/guides/routing/provider-selection.
 */
export interface OpenRouterProviderRouting {
  only: string[]
  allow_fallbacks: boolean
}

/**
 * Split the comma-separated slug list a user typed into OpenRouter provider slugs.
 * Empty entries are dropped, surrounding whitespace is trimmed, and duplicates keep
 * their first position so `only` reads in the order the user wrote it.
 */
export function parseOpenRouterProviderSlugs(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  const slugs: string[] = []
  const seen = new Set<string>()

  for (const part of value.split(",")) {
    const slug = part.trim()
    if (slug === "" || seen.has(slug)) {
      continue
    }

    seen.add(slug)
    slugs.push(slug)
  }

  return slugs
}

/**
 * Build OpenRouter's `provider` routing object for a locked selection, or `undefined`
 * when no provider is locked and OpenRouter's default load balancing should apply.
 *
 * Locking means two things, and they are set together on purpose: `only` narrows the
 * request to the listed providers, and `allow_fallbacks: false` drops the backup
 * providers OpenRouter would otherwise reach for when one of them is unavailable.
 * The user asked for these providers specifically, so a request either uses one of
 * them or fails with OpenRouter's own error instead of silently drifting elsewhere.
 */
export function getOpenRouterProviderRouting(
  settings: OpenRouterProviderSpecificSettings | undefined,
): OpenRouterProviderRouting | undefined {
  const only = parseOpenRouterProviderSlugs(settings?.only)
  if (only.length === 0) {
    return undefined
  }

  return { only, allow_fallbacks: false }
}
