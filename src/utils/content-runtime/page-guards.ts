// Pages the loader leaves alone. It runs on every page, so this file must stay
// free of imports.

// Interstitials that reload into the real page once they pass. The orchestrate
// script only appears on challenge pages; Cloudflare's bot detection script on
// ordinary pages lives under /cdn-cgi/challenge-platform/scripts/ instead. The
// older challenge form posts a `__cf_chl_…` token; its id alone is too common.
export function isCloudflareChallenge(doc: Document) {
  return (
    doc.querySelector(
      'script[src*="/cdn-cgi/challenge-platform/"][src*="/orchestrate/"], form#challenge-form[action*="__cf_chl"]',
    ) !== null
  )
}

export function shouldSkipDocument(doc: Document) {
  // XML and SVG documents have no <body> for the UI to mount in
  if (doc.documentElement?.namespaceURI !== "http://www.w3.org/1999/xhtml") return true
  return isCloudflareChallenge(doc)
}
