// The media view adds `/video/<n>` or `/photo/<n>`, which need not name the item it shows.
const XCOM_STATUS_PATH_PATTERNS = [
  /^\/i\/status\/(\d+)\/?$/,
  /^\/i\/status\/(\d+)\/(?:video|photo)\/\d+\/?$/,
  /^\/[^/]+\/status\/(\d+)\/?$/,
  /^\/[^/]+\/status\/(\d+)\/(?:video|photo)\/\d+\/?$/,
]

function isXcomHostname(hostname: string): boolean {
  return (
    hostname === "x.com" ||
    hostname.endsWith(".x.com") ||
    hostname === "twitter.com" ||
    hostname.endsWith(".twitter.com")
  )
}

export function getXcomStatusIdFromUrl(url: string): string | null {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }

  if (!isXcomHostname(parsedUrl.hostname)) {
    return null
  }

  for (const pattern of XCOM_STATUS_PATH_PATTERNS) {
    const match = parsedUrl.pathname.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

export function getXcomStatusId(): string | null {
  return getXcomStatusIdFromUrl(window.location.href)
}
