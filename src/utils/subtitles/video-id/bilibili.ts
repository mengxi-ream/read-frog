const BILIBILI_VIDEO_ID_PATTERN = /^(?:BV[\dA-Za-z]{10}|av\d+)$/
// The site may put a locale first, as in `/zh-Hans/video/BV…`.
const BILIBILI_VIDEO_PATH_PATTERN = /^\/(?:[A-Za-z-]+\/)?video\/([^/]+)\/?$/

// The video and part as `BV…:2`, from the path or a playlist's `bvid`; a missing or bad `p` is
// part 1, so every spelling of a part shares one id, matching the part the player reports.
export function getBilibiliPartIdFromUrl(url: string): string | null {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }

  const videoId = parsedUrl.pathname.startsWith("/list/")
    ? parsedUrl.searchParams.get("bvid")
    : parsedUrl.pathname.match(BILIBILI_VIDEO_PATH_PATTERN)?.[1]

  if (!videoId || !BILIBILI_VIDEO_ID_PATTERN.test(videoId)) {
    return null
  }

  const part = Number(parsedUrl.searchParams.get("p"))
  return `${videoId}:${Number.isInteger(part) && part > 0 ? part : 1}`
}

export function getBilibiliPartId(): string | null {
  return getBilibiliPartIdFromUrl(window.location.href)
}
