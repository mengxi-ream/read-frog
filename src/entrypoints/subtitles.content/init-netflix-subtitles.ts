import type { UniversalVideoAdapter } from "./universal-adapter"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { createNetflixSubtitlesAdapter, getNetflixConfig } from "./platforms/netflix"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"
import { renderSubtitlesTranslateButton } from "./renderer/render-translate-button"

const FLOATING_BUTTON_HOST_ID = "read-frog-netflix-subtitles-floating-button-host"

export async function initNetflixSubtitles() {
  const config = getNetflixConfig()
  const adapter = createNetflixSubtitlesAdapter(config)
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
