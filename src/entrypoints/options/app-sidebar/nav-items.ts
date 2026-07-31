export const ROUTE_DEFS = [
  { path: "/" },
  { path: "/preference" },
  { path: "/shortcuts" },
  { path: "/api-providers" },
  { path: "/custom-actions" },
  { path: "/page-translation" },
  { path: "/site-rules" },
  { path: "/video-subtitles" },
  { path: "/floating-button" },
  { path: "/selection-toolbar" },
  { path: "/context-menu" },
  { path: "/input-translation" },
  { path: "/tts" },

  // Detail pages drilled into from a `ConfigNavItem`. They own no sidebar entry — the
  // sidebar lists its links itself — but route exactly like any other page.
  { path: "/preference/config-backup" },
  { path: "/page-translation/custom-css" },
  { path: "/page-translation/prompts" },
] as const
