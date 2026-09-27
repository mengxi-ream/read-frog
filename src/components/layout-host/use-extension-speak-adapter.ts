import type { LayoutSpeakOptions, SpeakAdapter, SpeakLabels } from "@read-frog/layout-engine/dom"
import type { SurfaceByFeature } from "@/types/analytics"
import type { TTSConfig } from "@/types/config/tts"
import { useAtomValue } from "jotai"
import { useLayoutEffect, useMemo, useRef } from "react"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"

// Text-to-speech for the `[data-speak]` triggers of one rendered layout,
// through the extension's Edge TTS. One useTextToSpeech instance serves every
// trigger of the layout, so starting a trigger stops the previous one.

interface LatestTTS {
  play: (text: string, ttsConfig: TTSConfig) => Promise<void>
  stop: () => void
  ttsConfig: TTSConfig
}

export function useExtensionSpeakAdapter(
  surface: SurfaceByFeature["text_to_speech"] = ANALYTICS_SURFACE.SELECTION_TOOLBAR,
): LayoutSpeakOptions {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play, stop, isPlaying } = useTextToSpeech(surface)
  const latestRef = useRef<LatestTTS>({ play, stop, ttsConfig })
  // The run waiting for its audio to start: a trigger shows "loading" until
  // useTextToSpeech reports the first chunk playing.
  const pendingStartRef = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    latestRef.current = { play, stop, ttsConfig }
  })

  // Only the first start of a run counts: between chunks isPlaying drops back
  // to false while the next one is fetched, and the trigger stays "playing".
  // This relies on isPlaying being false whenever a new run starts, which
  // useTextToSpeech guarantees: stop() and the end of playback both reset it
  // before a run settles, and the layout ends a run before starting the next.
  useLayoutEffect(() => {
    if (!isPlaying) return
    const onStart = pendingStartRef.current
    pendingStartRef.current = null
    onStart?.()
  }, [isPlaying])

  const adapter = useMemo<SpeakAdapter>(
    () => ({
      play(text, { signal, onStart }) {
        pendingStartRef.current = onStart
        const forget = () => {
          if (pendingStartRef.current === onStart) pendingStartRef.current = null
        }
        // An aborted run is over: a late start is not reported. The layout
        // calls stop() right after aborting, which silences it.
        signal.addEventListener("abort", forget, { once: true })
        const { play: playText, ttsConfig: config } = latestRef.current
        // useTextToSpeech reports failures with its own toast; the rejection
        // only has to end the run.
        return playText(text, config).finally(() => {
          signal.removeEventListener("abort", forget)
          forget()
        })
      },
      stop() {
        latestRef.current.stop()
      },
    }),
    [],
  )

  // These keys replace the old speak button's tooltip.
  const speak = i18n.t("action.speak")
  const loading = i18n.t("speak.fetchingAudio")
  const playing = i18n.t("action.playing")
  const labels = useMemo<SpeakLabels>(
    () => ({ speak, loading, playing }),
    [speak, loading, playing],
  )

  return useMemo(() => ({ adapter, labels }), [adapter, labels])
}
