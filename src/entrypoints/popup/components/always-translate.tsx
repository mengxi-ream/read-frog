import { i18n } from '#imports'
import { useAtom, useAtomValue } from 'jotai'
import { Activity } from 'react'
import { Switch } from '@/components/shadcn/switch'
import { isCurrentSiteInPatternsAtom, toggleCurrentSiteAtom } from '../atoms/auto-translate'
import { isIgnoreTabAtom } from '../atoms/ignore'
import { isCurrentSiteInWhitelistAtom, isWhitelistModeAtom } from '../atoms/site-control'

export function AlwaysTranslate() {
  const isCurrentSiteInPatterns = useAtomValue(isCurrentSiteInPatternsAtom)
  const [, toggleCurrentSite] = useAtom(toggleCurrentSiteAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const isWhitelistMode = useAtomValue(isWhitelistModeAtom)
  const isCurrentSiteInWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)

  const shouldShow = !isWhitelistMode || isCurrentSiteInWhitelist

  return (
    <Activity mode={shouldShow ? 'visible' : 'hidden'}>
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
    </Activity>
  )
}
