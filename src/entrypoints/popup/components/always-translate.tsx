import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { initIsCurrentSiteInPatternsAtom, isCurrentSiteInPatternsAtom, toggleCurrentSiteAtom } from '../atom'

export function AlwaysTranslate() {
  const isCurrentSiteInPatterns = useAtomValue(isCurrentSiteInPatternsAtom)
  const initIsCurrentSiteInPatterns = useSetAtom(initIsCurrentSiteInPatternsAtom)
  const [, toggleCurrentSite] = useAtom(toggleCurrentSiteAtom)

  // Initialize the state when component mounts
  useEffect(() => {
    initIsCurrentSiteInPatterns()
  }, [initIsCurrentSiteInPatterns])

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium">
        {i18n.t('popup.alwaysTranslate')}
      </span>
      <Switch
        checked={isCurrentSiteInPatterns}
        onCheckedChange={toggleCurrentSite}
      />
    </div>
  )
}
