import type { LangCodeISO6393 } from "@read-frog/definitions"
import { langCodeISO6393Schema } from "@read-frog/definitions"

/**
 * The guide page may omit or mistype the language code; only a valid explicit
 * code may reach the config. The old literal "eng" fallback silently
 * overwrote the user's configured target language on every onboarding visit.
 */
export function resolveGuideTargetLanguage(data: unknown): LangCodeISO6393 | null {
  if (typeof data !== "object" || data === null) return null
  const parsed = langCodeISO6393Schema.safeParse(
    (data as { langCodeISO6393?: unknown }).langCodeISO6393,
  )
  return parsed.success ? parsed.data : null
}
