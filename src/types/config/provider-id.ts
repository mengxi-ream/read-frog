import { z } from "zod"
import { resolveLegacyProviderId } from "@/utils/constants/provider-ids"

/**
 * Reads `schema`'s provider id as config stores it.
 *
 * A config written before each Built-in AI model was a provider of its own
 * names Built-in AI by tier (`read-frog-free-ai`, `read-frog-advance-ai`) until
 * the background's v126 → v127 migration runs. UI contexts can load ahead of
 * it, and a config that fails to parse there falls back to DEFAULT_CONFIG,
 * which the next write then saves over the user's settings. Read as the model
 * the migration moves it to, a tier id keeps such a config parseable, as
 * `storedLanguageTagSchema` does for language codes.
 *
 * The input type stays the schema's own: code writes model ids, and only
 * storage holds a tier id.
 */
function readingLegacyProviderIds<T extends z.ZodType>(schema: T) {
  return z.preprocess<unknown, T, z.input<T>>(
    (value: unknown) => (typeof value === "string" ? resolveLegacyProviderId(value) : value),
    schema,
  )
}

export const storedProviderIdSchema = readingLegacyProviderIds(z.string().nonempty())

/** An optional id, which an empty string satisfies as before. */
export const optionalStoredProviderIdSchema = readingLegacyProviderIds(z.string().optional())

/**
 * A list of ids, each read as above. Both tiers read as the same model, so a
 * list that held both keeps it once, where the first of them was.
 */
export const storedProviderIdListSchema = z.preprocess<unknown, z.ZodArray<z.ZodString>, string[]>(
  (value: unknown) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.map((id: unknown) => (typeof id === "string" ? resolveLegacyProviderId(id) : id)),
          ),
        ]
      : value,
  z.array(z.string().min(1)),
)
