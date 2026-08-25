import { useAtomValue } from "jotai"
import { use, useEffect } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ensureSubtitlesCustomCSS } from "@/utils/host/translate/ui/style-injector"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"

/**
 * Keep the subtitles shadow root's custom stylesheet in step with the config.
 *
 * The options-page preview scopes the same CSS to its preview box; here the shadow root is already
 * the boundary, so the user's rules go in untouched.
 */
export function useSubtitlesCustomCSS(): void {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const shadowWrapper = use(ShadowWrapperContext)
  const customCSS = style.customCSS

  useEffect(() => {
    const root = shadowWrapper?.getRootNode()
    if (!(root instanceof ShadowRoot)) return

    // Clearing the CSS has to write an empty sheet rather than skip the call, or the last saved
    // rules stay adopted and the subtitles keep a style the user just turned off.
    void ensureSubtitlesCustomCSS(root, customCSS ?? "")
  }, [customCSS, shadowWrapper])
}
