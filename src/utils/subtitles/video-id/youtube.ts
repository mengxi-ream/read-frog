export function getYoutubeVideoId(): string | null {
  const urlParams = new URLSearchParams(window.location.search)
  const v = urlParams.get("v")
  if (v)
    return v

  const embedMatch = window.location.pathname.match(/\/embed\/([^/?]+)/)
  if (embedMatch)
    return embedMatch[1]

  if (window.location.hostname === "youtu.be") {
    const pathMatch = window.location.pathname.match(/^\/([^/?]+)/)
    if (pathMatch)
      return pathMatch[1]
  }

  return null
}
