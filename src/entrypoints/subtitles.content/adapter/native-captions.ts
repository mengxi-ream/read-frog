import type { AdapterContext } from "./adapter-context"
import { HIDE_NATIVE_CAPTIONS_STYLE_ID } from "@/utils/constants/subtitles"
import { subtitlesStore } from "../atoms"
import { lookUpAtom } from "../learning/atoms"

type NativeCaptionsDeps = Pick<AdapterContext, "config" | "getFetcher">

export class NativeCaptions {
  private readonly config: NativeCaptionsDeps["config"]
  private readonly getFetcher: NativeCaptionsDeps["getFetcher"]
  private isNativeSubtitlesHidden = false

  constructor({ config, getFetcher }: NativeCaptionsDeps) {
    this.config = config
    this.getFetcher = getFetcher
  }

  showNativeSubtitles() {
    // Our subtitles step aside, and a word lookup on them goes too.
    subtitlesStore.set(lookUpAtom, null)
    this.getFetcher().showNativeSubtitles?.()
    if (!this.isNativeSubtitlesHidden) {
      return
    }

    const style = document.getElementById(HIDE_NATIVE_CAPTIONS_STYLE_ID)
    style?.remove()
    this.isNativeSubtitlesHidden = false
  }

  hideNativeSubtitles() {
    this.getFetcher().hideNativeSubtitles?.()
    if (this.isNativeSubtitlesHidden || !this.config.selectors.nativeSubtitles) {
      return
    }

    if (document.getElementById(HIDE_NATIVE_CAPTIONS_STYLE_ID)) {
      this.isNativeSubtitlesHidden = true
      return
    }

    const style = document.createElement("style")
    style.id = HIDE_NATIVE_CAPTIONS_STYLE_ID
    style.textContent = `
      ${this.config.selectors.nativeSubtitles},
      ${this.config.selectors.nativeSubtitles} * {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `
    document.head.appendChild(style)
    this.isNativeSubtitlesHidden = true
  }
}
