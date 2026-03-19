export const ROUTE_DEFS = [
  { path: "/" },
  { path: "/api-providers" },
  { path: "/custom-actions" },
  { path: "/translation" },
  { path: "/video-subtitles" },
  { path: "/floating-button" },
  { path: "/selection-toolbar" },
  { path: "/context-menu" },
  { path: "/input-translation" },
  ...(import.meta.env.BROWSER === "firefox" ? [] : [{ path: "/tts" }]),
  { path: "/statistics" },
  { path: "/config" },
] as const
