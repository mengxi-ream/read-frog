const EMBED_PATH_PATTERN = /\/embed\/([^/?]+)/
const SHORTS_PATH_PATTERN = /\/shorts\/([^/?]+)/
const SHORT_URL_PATH_PATTERN = /^\/([^/?]+)/

export function getYoutubeVideoId(): string | null {
  const urlParams = new URLSearchParams(window.location.search)
  const v = urlParams.get("v")
  if (v)
    return v

  const embedMatch = window.location.pathname.match(EMBED_PATH_PATTERN)
  if (embedMatch)
    return embedMatch[1]

  const shortsMatch = window.location.pathname.match(SHORTS_PATH_PATTERN)
  if (shortsMatch)
    return shortsMatch[1]

  if (window.location.hostname === "youtu.be") {
    const pathMatch = window.location.pathname.match(SHORT_URL_PATH_PATTERN)
    if (pathMatch)
      return pathMatch[1]
  }

  return null
}
