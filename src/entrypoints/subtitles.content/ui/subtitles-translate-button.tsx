import { useEffect, useEffectEvent, useState } from 'react'
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
          isEnabled ? 'opacity-100' : 'opacity-70',
        )}
      />
      <div
        className={cn(
          'absolute bottom-1 right-0 px-1 py-0.5 rounded text-[8px] font-medium leading-none transition-colors duration-200',
          isEnabled ? 'bg-green-500 text-white' : 'bg-gray-500 text-white',
        )}
      >
        {isEnabled ? 'ON' : 'OFF'}
      </div>
    </button>
  )
}
