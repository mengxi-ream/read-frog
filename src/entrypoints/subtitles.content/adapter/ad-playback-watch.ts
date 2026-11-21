import type { AdapterContext } from "./adapter-context"
import { adPlayingAtom, subtitlesStore } from "../atoms"

type AdPlaybackWatchDeps = Pick<AdapterContext, "config"> & {
  onAdStarted: () => void
  onAdEnded: () => void
}

export class AdPlaybackWatch {
  private readonly config: AdPlaybackWatchDeps["config"]
  private readonly onAdStarted: AdPlaybackWatchDeps["onAdStarted"]
  private readonly onAdEnded: AdPlaybackWatchDeps["onAdEnded"]
  private adObserver: MutationObserver | null = null
  private observedAdPlayer: HTMLElement | null = null

  constructor({ config, onAdStarted, onAdEnded }: AdPlaybackWatchDeps) {
    this.config = config
    this.onAdStarted = onAdStarted
    this.onAdEnded = onAdEnded
  }

  setupAdObserver() {
    if (!this.config.isAdPlaying) {
      return
    }

    this.teardownAdObserver()

    const player = document.querySelector<HTMLElement>(this.config.selectors.playerContainer)
    if (!player) {
      subtitlesStore.set(adPlayingAtom, false)
      return
    }

    this.observedAdPlayer = player
    this.syncAdPlayingState()

    this.adObserver = new MutationObserver(() => {
      this.syncAdPlayingState()
    })
    this.adObserver.observe(player, { attributes: true, attributeFilter: ["class"] })
  }

  teardownAdObserver() {
    this.adObserver?.disconnect()
    this.adObserver = null
    this.observedAdPlayer = null
    subtitlesStore.set(adPlayingAtom, false)
  }

  private syncAdPlayingState() {
    const isAdPlaying = this.config.isAdPlaying
    if (!isAdPlaying) {
      return
    }

    const player =
      this.observedAdPlayer ??
      document.querySelector<HTMLElement>(this.config.selectors.playerContainer)

    const playing = !!player && isAdPlaying(player)
    const wasPlaying = subtitlesStore.get(adPlayingAtom)
    if (playing === wasPlaying) {
      return
    }

    subtitlesStore.set(adPlayingAtom, playing)

    if (playing) {
      this.onAdStarted()
      return
    }

    this.onAdEnded()
  }
}
