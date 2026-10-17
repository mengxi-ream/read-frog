import type { SubtitlesProvidersAdapter } from "../universal-adapter"
import themeCSS from "@/assets/styles/theme.css?inline"
import {
  SUBTITLES_SIDEBAR_HOST_ID,
  SUBTITLES_SIDEBAR_VIEWPORT_MARGIN,
  SUBTITLES_SIDEBAR_WIDTH,
  SUBTITLES_THEME,
} from "@/utils/constants/subtitles"
import {
  createReactShadowHost,
  removeReactShadowHost,
} from "@/utils/react-shadow-host/create-shadow-host"
import { SubtitlesSidebar } from "../ui/subtitles-sidebar"
import { SubtitlesProviders } from "../ui/subtitles-ui-context"

const HOST_STYLE = `
  position: fixed;
  top: ${SUBTITLES_SIDEBAR_VIEWPORT_MARGIN}px;
  right: ${SUBTITLES_SIDEBAR_VIEWPORT_MARGIN}px;
  bottom: ${SUBTITLES_SIDEBAR_VIEWPORT_MARGIN}px;
  width: ${SUBTITLES_SIDEBAR_WIDTH}px;
  pointer-events: none;
  z-index: 2147483000;
`

/**
 * Fullscreen renders only the fullscreen element's subtree, so the host has to
 * follow it in and out; anywhere else it lives on <body>, where the host page's
 * SPA re-renders cannot detach it.
 */
function followFullscreen(shadowHost: HTMLElement): () => void {
  const reparent = () => {
    const parent = document.fullscreenElement ?? document.body
    if (shadowHost.parentElement !== parent) parent.appendChild(shadowHost)
  }
  reparent()
  document.addEventListener("fullscreenchange", reparent)
  return () => document.removeEventListener("fullscreenchange", reparent)
}

// Tracked by reference: the host moves with fullscreen, and a detached one has no id lookup.
let mountedSidebar: { host: HTMLElement; stopFollowing: () => void } | null = null

export function mountSubtitlesSidebar(adapter: SubtitlesProvidersAdapter): void {
  if (!adapter.supportsSidebar) return
  if (mountedSidebar || document.getElementById(SUBTITLES_SIDEBAR_HOST_ID)) return

  const shadowHost = createReactShadowHost(
    <SubtitlesProviders adapter={adapter}>
      <SubtitlesSidebar />
    </SubtitlesProviders>,
    {
      position: "block",
      inheritStyles: false,
      cssContent: [themeCSS],
      forcedTheme: SUBTITLES_THEME,
      style: { height: "100%" },
    },
  )

  shadowHost.id = SUBTITLES_SIDEBAR_HOST_ID
  shadowHost.style.cssText = HOST_STYLE

  mountedSidebar = { host: shadowHost, stopFollowing: followFullscreen(shadowHost) }
}

/** The sidebar is bound to one adapter; a page that swaps adapters unmounts it and mounts anew. */
export function unmountSubtitlesSidebar(): void {
  const host = mountedSidebar?.host ?? document.getElementById(SUBTITLES_SIDEBAR_HOST_ID)
  mountedSidebar?.stopFollowing()
  mountedSidebar = null
  if (host) removeReactShadowHost(host)
}
