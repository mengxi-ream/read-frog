import type { UniversalVideoAdapter } from "../universal-adapter"
import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { createNetflixSubtitlesAdapter, getNetflixConfig } from "./netflix"

// Registry of streaming sites that render official bilingual subtitles through the
// shared StreamingSubtitlesFetcher. Each supported platform is one StreamingSite
// entry; a new site (HBO Max, …) plugs in by adding its adapter here — the capture,
// source/target selection and alignment plumbing is shared, not re-implemented.
export interface StreamingSite {
  id: string
  matches: (url: URL) => boolean
  create: () => { config: PlatformConfig, adapter: UniversalVideoAdapter }
}

const STREAMING_SITES: StreamingSite[] = [
  {
    id: "netflix",
    matches: url => /(?:^|\.)netflix\.com$/i.test(url.hostname),
    create: () => {
      const config = getNetflixConfig()
      return { config, adapter: createNetflixSubtitlesAdapter(config) }
    },
  },
]

export function findStreamingSite(url: URL): StreamingSite | null {
  return STREAMING_SITES.find(site => site.matches(url)) ?? null
}

export function isStreamingHost(url: URL): boolean {
  return findStreamingSite(url) !== null
}
