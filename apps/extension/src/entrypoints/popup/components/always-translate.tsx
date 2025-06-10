import { useAtom, useAtomValue } from 'jotai'
import { Switch } from '@/components/ui/switch'
import { isCurrentSiteInPatternsAtom, isIgnoreTabAtom, toggleCurrentSiteAtom } from '../atom'

export function AlwaysTranslate() {
  const isCurrentSiteInPatterns = useAtomValue(isCurrentSiteInPatternsAtom)
  const [, toggleCurrentSite] = useAtom(toggleCurrentSiteAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium">
        {i18n.t('popup.alwaysTranslate')}
      </span>
      <Switch
        checked={isCurrentSiteInPatterns}
        onCheckedChange={toggleCurrentSite}
        disabled={isIgnoreTab}
      />
    </div>
  )
}
