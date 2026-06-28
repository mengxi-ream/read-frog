import type { StreamingSiteAdapter } from "./streaming/streaming-fetcher"
import { parseSubtitleText } from "./streaming/cue-parser"
import { clearTrackStore, resolveTrackText, waitForNetworkTracks } from "./streaming/track-store"

// Netflix publishes subtitle tracks inside its manifest/pathEvaluator JSON. The
// MAIN-world interceptor extracts the timed-text download URLs; the shared
// StreamingSubtitlesFetcher handles source/target selection + bilingual
// alignment (see ./streaming/streaming-fetcher.ts).
export const netflixSiteAdapter: StreamingSiteAdapter = {
  id: "netflix",
  matches: url => /(?:^|\.)netflix\.com$/i.test(url.hostname),
  discoverTracks: () => waitForNetworkTracks(),
  fetchTrack: async track => parseSubtitleText(await resolveTrackText(track)),
  cleanup: () => clearTrackStore(),
}
