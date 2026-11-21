import type { AdapterContext } from "./adapter-context"
import type { SubtitlesProvidersAdapter } from "./subtitles-providers-adapter"
import { toastManager } from "@/components/ui/base-ui/toast"
import { getLocalConfig } from "@/utils/config/storage"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { i18n } from "@/utils/i18n"
import { removeReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { subtitlesPositionAtom, subtitlesStore } from "../atoms"
import { renderSubtitlesTranslateButton } from "../renderer/render-translate-button"
import { SubtitlesScheduler } from "../subtitles-scheduler"

type PlayerAttachmentDeps = Pick<AdapterContext, "config" | "lifecycle"> & {
  adapter: SubtitlesProvidersAdapter
  onPlayerReady: () => Promise<void>
}

export class PlayerAttachment {
  private readonly config: PlayerAttachmentDeps["config"]
  private readonly lifecycle: PlayerAttachmentDeps["lifecycle"]
  private readonly adapter: PlayerAttachmentDeps["adapter"]
  private readonly onPlayerReady: PlayerAttachmentDeps["onPlayerReady"]
  subtitlesScheduler: SubtitlesScheduler | null = null

  constructor({ config, lifecycle, adapter, onPlayerReady }: PlayerAttachmentDeps) {
    this.config = config
    this.lifecycle = lifecycle
    this.adapter = adapter
    this.onPlayerReady = onPlayerReady
  }

  async restorePosition() {
    const config = await getLocalConfig()
    const position = config?.videoSubtitles?.position
    if (position) {
      subtitlesStore.set(subtitlesPositionAtom, { ...position })
    }
  }

  destroyScheduler() {
    this.subtitlesScheduler?.reset()
    this.subtitlesScheduler?.stop()
    this.subtitlesScheduler = null
  }

  private async initializeScheduler() {
    const generation = this.lifecycle.playerGeneration.current()
    const video = (await waitForElement(
      this.config.selectors.video,
      (el) => !!el.closest(this.config.selectors.playerContainer),
    )) as HTMLVideoElement | null

    // Waited on a player the page has since left or replaced: no scheduler, and nothing missing.
    if (this.lifecycle.isPlayerSuperseded(generation)) return
    if (!video) {
      toastManager.add({ type: "error", title: i18n.t("subtitles.errors.videoNotFound") })
      return
    }

    this.subtitlesScheduler = new SubtitlesScheduler({ videoElement: video })
    this.subtitlesScheduler.start()
    this.subtitlesScheduler.hide()
  }

  async attachPlayer() {
    const generation = this.lifecycle.playerGeneration.current()
    void this.renderTranslateButton()
    await this.initializeScheduler()
    // Left or reset while it waited: the init that follows the player starts subtitles.
    if (this.lifecycle.isPlayerSuperseded(generation)) return
    await this.onPlayerReady()
  }

  removeTranslateButton() {
    const toggleButton = document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)
    if (toggleButton) removeReactShadowHost(toggleButton)
  }

  private async renderTranslateButton() {
    const controlsBar = this.config.selectors.controlsBar
    if (!controlsBar) {
      return
    }

    const generation = this.lifecycle.playerGeneration.current()
    const container = await waitForElement(controlsBar)
    if (this.lifecycle.isPlayerSuperseded(generation)) return
    if (!container) {
      if (!this.config.embedded) {
        toastManager.add({
          type: "error",
          title: i18n.t("subtitles.errors.controlsBarNotFound"),
        })
      }
      return
    }

    const existingButton = container.querySelector<HTMLElement>(`#${TRANSLATE_BUTTON_CONTAINER_ID}`)
    if (existingButton) {
      removeReactShadowHost(existingButton)
    }

    const toggleButton = renderSubtitlesTranslateButton({
      adapter: this.adapter,
      height: this.config.translateButtonHeight,
    })

    if (this.config.embedded) {
      container.appendChild(toggleButton)
    } else {
      container.insertBefore(toggleButton, container.firstChild)
    }
  }
}
