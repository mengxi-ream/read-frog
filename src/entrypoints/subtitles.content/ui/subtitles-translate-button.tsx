import { Activity, useEffect, useEffectEvent, useState } from 'react'
import logo from '@/assets/icons/original/read-frog.png'
import { cn } from '@/lib/utils'
import { getLocalConfig } from '@/utils/config/storage'
import { TRANSLATE_BUTTON_CLASS } from '@/utils/constants/subtitles'

export function SubtitleToggleButton(
  { onToggle }:
  {
    onToggle: (enabled: boolean) => void
  },
) {
  const [isEnabled, setIsEnabled] = useState(false)

  const tryStartSubtitles = useEffectEvent(async () => {
    const config = await getLocalConfig()
    const autoStart = config?.videoSubtitles?.autoStart ?? false
    if (autoStart) {
      setIsEnabled(true)
      onToggle(true)
    }
  })

  useEffect(() => {
    void tryStartSubtitles()
  }, [])

  const handleClick = () => {
    const newState = !isEnabled
    setIsEnabled(newState)
    onToggle(newState)
  }

  return (
    <button
      type="button"
      aria-label="Subtitle Translation Toggle"
      onClick={handleClick}
      className={`${TRANSLATE_BUTTON_CLASS} w-12 h-full flex items-center justify-center relative bg-transparent border-none p-0 m-0 cursor-pointer`}
    >
      <img
        src={logo}
        alt="Subtitle Toggle"
        className={cn(
          'w-8 h-8 transition-opacity duration-200 object-contain block',
          isEnabled ? 'opacity-100' : 'opacity-50',
        )}
      />
      <Activity mode={isEnabled ? 'visible' : 'hidden'}>
        <div
          className={cn(
            'absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full transition-colors duration-200 bg-[#3ea6ff]',
          )}
        />
      </Activity>
    </button>
  )
}
