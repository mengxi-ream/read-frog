import type { SupportedUiLocale } from "@/utils/i18n/resources"

const FEATUREBASE_PORTAL_ORIGIN = "https://feedback.readfrog.app"

export type FeaturebasePortalDestination = "feedback" | "roadmap"

export interface FeaturebaseFeedbackMetadata {
  [key: string]: string | undefined
  browser: string
  extension_version: string
  page_url?: string
}

export function buildFeaturebasePortalUrl({
  destination,
  locale,
  metadata,
}: {
  destination: FeaturebasePortalDestination
  locale: SupportedUiLocale
  metadata?: Record<string, string | undefined>
}) {
  const pathname = destination === "roadmap" ? `/${locale}/roadmap` : `/${locale}`
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

export function buildFeaturebaseFeedbackMetadata({
  browserName,
  extensionVersion,
  pageUrl,
}: {
  browserName: string
  extensionVersion: string
  pageUrl: string
}): FeaturebaseFeedbackMetadata {
  const metadata: FeaturebaseFeedbackMetadata = {
    browser: browserName,
    extension_version: extensionVersion,
  }

  try {
    const url = new URL(pageUrl)
    if (url.protocol === "http:" || url.protocol === "https:") {
      metadata.page_url = `${url.origin}${url.pathname}`
    }
  } catch {
    // Keep the extension version even when the current page URL is not parseable.
  }

  return metadata
}
