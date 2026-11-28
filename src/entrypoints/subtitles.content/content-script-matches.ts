import { PRIME_VIDEO_MATCHES } from "@/utils/constants/subtitles"

export const subtitlesContentScriptMatches = [
  "*://*.youtube.com/*",
  "*://*.youtube-nocookie.com/*",
  "*://x.com/*",
  "*://*.x.com/*",
  "*://twitter.com/*",
  "*://*.twitter.com/*",
  "*://www.netflix.com/*",
  "*://www.bilibili.com/*",
  "*://*.udemy.com/*",
  "*://courses.edx.org/*",
  ...PRIME_VIDEO_MATCHES,
]
