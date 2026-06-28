import type { StreamingSite } from "./platforms/streaming"
import type { UniversalVideoAdapter } from "./universal-adapter"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { initYoutubeSubtitles } from "./init-youtube-subtitles"
import { findStreamingSite } from "./platforms/streaming"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"
import { renderSubtitlesTranslateButton } from "./renderer/render-translate-button"

const FLOATING_BUTTON_HOST_ID = "read-frog-streaming-subtitles-floating-button-host"

let hasBootstrappedSubtitlesRuntime = false

export async function bootstrapSubtitlesRuntime() {
  if (hasBootstrappedSubtitlesRuntime) {
    return
  }

  hasBootstrappedSubtitlesRuntime = true

  const site = findStreamingSite(new URL(window.location.href))
  if (site)
    await initStreamingSite(site)
  else
    initYoutubeSubtitles()
}

async function initStreamingSite(site: StreamingSite) {
  const { config, adapter } = site.create()
  await mountSubtitlesUI({ adapter, config })
  mountFloatingButton(adapter)
  await adapter.initialize()
}

function mountFloatingButton(adapter: UniversalVideoAdapter) {
  if (document.getElementById(FLOATING_BUTTON_HOST_ID) || document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID))
    return

  const host = document.createElement("div")
  host.id = FLOATING_BUTTON_HOST_ID
  host.style.cssText = "position:fixed;right:20px;bottom:96px;width:48px;height:48px;z-index:2147483647;pointer-events:auto;"
  host.appendChild(renderSubtitlesTranslateButton({ adapter }))
  document.body.appendChild(host)
}
