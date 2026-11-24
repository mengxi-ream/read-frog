import type { FeatureTag } from "@/utils/features"

/**
 * Every options page. A page tagged with a `feature` belongs to it, so simple mode takes it
 * away with the feature: it leaves the sidebar, and opening it lands on the feature's switch
 * instead. Untagged pages, like the API providers or Custom AI Actions that several features
 * share, are always there.
 *
 * Page Translation's pages are untagged for that reason: selection translation, input
 * translation and the Translation Hub use its prompts, its translation queue and the cache it
 * clears, so they stay while Page Translation is off.
 */
export const ROUTE_DEFS = [
  { path: "/" },
  { path: "/preference" },
  { path: "/shortcuts" },
  { path: "/api-providers" },
  { path: "/custom-actions" },
  { path: "/page-translation" },
  { path: "/video-subtitles", feature: "videoSubtitles" },
  { path: "/floating-button", feature: "floatingButton" },
  { path: "/selection-toolbar", feature: "selectionToolbar" },
  { path: "/context-menu", feature: "contextMenu" },
  { path: "/input-translation", feature: "inputTranslation" },
  { path: "/tts" },
  // Advanced is a sidebar GROUP with no page of its own; this path only exists
  // so links made before that change still land somewhere.
  { path: "/advanced" },
  { path: "/help-and-community" },

  // Detail pages drilled into from a `ConfigNavItem`. They own no sidebar entry — the
  // sidebar lists its links itself — but route exactly like any other page.
  { path: "/advanced/glossary", feature: "glossary" },
  { path: "/advanced/glossary/:glossaryId", feature: "glossary" },
  { path: "/advanced/simple-mode" },
  { path: "/preference/config-backup" },
  { path: "/preference/extension-activation" },
  { path: "/page-translation/custom-css" },
  { path: "/page-translation/prompts" },
  { path: "/page-translation/translation-control" },
  { path: "/page-translation/translation-control/auto-translate-websites" },
  { path: "/page-translation/translation-control/never-auto-translate-websites" },
  { path: "/page-translation/translation-control/site-rules" },
  { path: "/page-translation/translation-queue" },
  { path: "/video-subtitles/sites", feature: "videoSubtitles" },
  { path: "/video-subtitles/style", feature: "videoSubtitles" },
  { path: "/video-subtitles/style/custom-css", feature: "videoSubtitles" },
  { path: "/video-subtitles/prompts", feature: "videoSubtitles" },
  { path: "/video-subtitles/subtitles-queue", feature: "videoSubtitles" },
] as const satisfies readonly { path: string; feature?: FeatureTag }[]

export type RoutePath = (typeof ROUTE_DEFS)[number]["path"]

const ROUTE_FEATURES = new Map<string, FeatureTag>(
  ROUTE_DEFS.flatMap((def) => ("feature" in def ? [[def.path, def.feature] as const] : [])),
)

/** The feature a page belongs to, if any. */
export function getRouteFeature(path: RoutePath): FeatureTag | undefined {
  return ROUTE_FEATURES.get(path)
}
