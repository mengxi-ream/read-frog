import { i18n } from '#imports'
import { IconVolume } from '@tabler/icons-react'
import { useAtomValue } from 'jotai'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useTextToSpeech } from '@/hooks/use-audio-player'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { getTTSProvidersConfig } from '@/utils/config/helpers'
import { DEFAULT_CONFIG } from '@/utils/constants/config'

/**
 * High-level hook for text-to-speech with validation and toast notifications
 * Uses useAudioPlayer internally for audio playback
 * For more control, use useAudioPlayer directly
 */
export function useSpeakText() {
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const betaExperienceConfig = useAtomValue(configFieldsAtomMap.betaExperience)

  const { play, isFetching, isPlaying } = useTextToSpeech()

  const ttsProvidersConfig = useMemo(() => getTTSProvidersConfig(providersConfig), [providersConfig])
  const ttsProviderConfig = useMemo(() => ttsProvidersConfig[0], [ttsProvidersConfig])

  const isBetaEnabled = Boolean(betaExperienceConfig.enabled)
  const hasProvider = Boolean(ttsProviderConfig)

  /**
   * Speak the given text using TTS
   * Handles all validation, error cases, and toast notifications
   */
  const speak = useCallback(
    (text: string) => {
      if (!text) {
        toast.error(i18n.t('speak.noTextSelected'))
        return
      }

      if (!isBetaEnabled) {
        return
      }

      if (!ttsProviderConfig) {
        toast.error(i18n.t('speak.openaiNotConfigured'))
        return
      }

      const { model, voice, speed } = betaExperienceConfig.enabled ? ttsConfig : DEFAULT_CONFIG.tts
      const toastId = toast.loading(i18n.t('speak.fetchingAudio'))

      play(text, { providerId: ttsProviderConfig.id, model, voice, speed })
        .then(() => {
          toast.success(i18n.t('speak.playingAudio'), {
            id: toastId,
            icon: <IconVolume className="size-5 animate-pulse" />,
            duration: 2000,
          })
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : i18n.t('speak.failedToGenerateSpeech'), {
            id: toastId,
          })
        })
    },
    [isBetaEnabled, ttsProviderConfig, betaExperienceConfig, ttsConfig, play],
  )

  return {
    speak,
    isPending: isFetching || isPlaying,
    isBetaEnabled,
    hasApiKey: hasProvider,
    canSpeak: isBetaEnabled && hasProvider,
  }
}
