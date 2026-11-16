import type { SubtitlesPlatform, SubtitlesPlatformMode } from "@/types/config/subtitles"

function isHostOrSubdomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

/**
 * The platform whose player a frame on `hostname` plays, for the hosts the subtitles loader
 * goes into (`subtitlesContentScriptMatches`). An embedded YouTube player is YouTube wherever
 * the page around it is.
 */
export function getSubtitlesPlatformForHostname(hostname: string): SubtitlesPlatform | null {
  if (
    isHostOrSubdomain(hostname, "youtube.com") ||
    isHostOrSubdomain(hostname, "youtube-nocookie.com")
  ) {
    return "youtube"
  }
  if (isHostOrSubdomain(hostname, "x.com") || isHostOrSubdomain(hostname, "twitter.com")) {
    return "xcom"
  }
  if (hostname === "www.netflix.com") return "netflix"
  if (hostname === "www.bilibili.com") return "bilibili"
  if (isHostOrSubdomain(hostname, "udemy.com")) return "udemy"
  if (hostname === "courses.edx.org") return "edx"
  return null
}

/**
 * Whether subtitles are set to "off" for the platform on `hostname`. Reads the subtitles
 * config as stored, so it also takes one from before v126, whose single `enabled` switch
 * covered every platform. A host that is no platform's is never off here: the platform code
 * passes it over on its own.
 */
export function isSubtitlesOffOnHost(
  videoSubtitles:
    | { platforms?: Partial<Record<SubtitlesPlatform, SubtitlesPlatformMode>>; enabled?: unknown }
    | null
    | undefined,
  hostname: string,
): boolean {
  if (!videoSubtitles) return false
  const platform = getSubtitlesPlatformForHostname(hostname)
  const mode = platform ? videoSubtitles.platforms?.[platform] : undefined
  if (mode !== undefined) return mode === "off"
  return videoSubtitles.enabled === false
}
