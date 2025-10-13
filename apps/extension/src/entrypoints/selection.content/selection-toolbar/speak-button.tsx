import { i18n } from '#imports'
import { IconLoader2, IconVolume } from '@tabler/icons-react'
import { useAtomValue } from 'jotai'
import { toast } from 'sonner'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ttsProviderConfigAtom } from '@/utils/atoms/provider'
import { selectionContentAtom } from './atom'

export function SpeakButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const ttsProviderConfig = useAtomValue(ttsProviderConfigAtom)
  const { play, isFetching, isPlaying } = useTextToSpeech()

  const handleClick = async () => {
    if (!selectionContent) {
      toast.error(i18n.t('speak.noTextSelected'))
      return
    }

    if (!ttsProviderConfig) {
      toast.error(i18n.t('speak.openaiNotConfigured'))
      return
    }

    void play(selectionContent, ttsConfig, ttsProviderConfig)
  }

  if (!ttsProviderConfig) {
    return null
  }

  return (
    <button
      type="button"
      className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleClick}
      disabled={isFetching || isPlaying}
      title={isFetching ? 'Fetching audio…' : isPlaying ? 'Playing audio…' : 'Speak selected text'}
    >
      {isFetching || isPlaying
        ? (
            <IconLoader2 className="size-4 animate-spin" strokeWidth={1.6} />
          )
        : (
            <IconVolume className="size-4" strokeWidth={1.6} />
          )}
    </button>
  )
}
