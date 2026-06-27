import type { UniversalVideoAdapter } from "./universal-adapter"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { createStreamingSubtitlesAdapter } from "./platforms/streaming"
import { getStreamingConfig } from "./platforms/streaming/config"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"
import { renderSubtitlesTranslateButton } from "./renderer/render-translate-button"

const FLOATING_BUTTON_HOST_ID = "read-frog-streaming-subtitles-floating-button-host"

export async function initStreamingSubtitles() {
  const config = getStreamingConfig()
  const adapter = createStreamingSubtitlesAdapter(config)

  await mountSubtitlesUI({ adapter, config })
  mountFloatingSubtitlesButton(adapter)
  await adapter.initialize()
}

function mountFloatingSubtitlesButton(adapter: UniversalVideoAdapter) {
  if (document.getElementById(FLOATING_BUTTON_HOST_ID))
    return

  const existingButton = document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)
  if (existingButton)
    return

  const host = document.createElement("div")
  host.id = FLOATING_BUTTON_HOST_ID
  host.style.cssText = `
    position: fixed;
    right: 20px;
    bottom: 96px;
    width: 48px;
    height: 48px;
    z-index: 2147483647;
    pointer-events: auto;
  `

  host.appendChild(renderSubtitlesTranslateButton({ adapter }))
  document.body.appendChild(host)
}
