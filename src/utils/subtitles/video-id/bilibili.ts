const BILIBILI_VIDEO_ID_PATTERN = /^(?:BV[\dA-Za-z]{10}|av\d+)$/
// The site may put a locale first, as in `/zh-Hans/video/BV…`.
const BILIBILI_VIDEO_PATH_PATTERN = /^\/(?:[A-Za-z-]+\/)?video\/([^/]+)\/?$/

/**
 * The video and its part, as `BV…:2`. A playlist page names the video in `bvid` instead of the
 * path, and a missing `p` is the first part, so both spellings of one part share an id.
 */
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

  return `${videoId}:${parsedUrl.searchParams.get("p") ?? "1"}`
}

export function getBilibiliPartId(): string | null {
  return getBilibiliPartIdFromUrl(window.location.href)
}
