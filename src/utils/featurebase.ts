import type { SupportedUiLocale } from "@/utils/i18n/resources"

const FEATUREBASE_PORTAL_ORIGIN = "https://feedback.readfrog.app"

export type FeaturebasePortalDestination = "feedback" | "roadmap" | "tickets"

export function buildFeaturebasePortalUrl({
  destination,
  locale,
  metadata,
}: {
  destination: FeaturebasePortalDestination
  locale: SupportedUiLocale
  metadata?: Record<string, string | undefined>
}) {
  const pathname = destination === "feedback" ? `/${locale}` : `/${locale}/${destination}`
  const url = new URL(pathname, FEATUREBASE_PORTAL_ORIGIN)

  const definedMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      )
    : undefined

  if (definedMetadata && Object.keys(definedMetadata).length > 0) {
    url.searchParams.set("metaData", JSON.stringify(definedMetadata))
  }

  return url.toString()
}
