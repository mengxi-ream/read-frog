import { i18n } from '#imports'
import { useAtomValue, useSetAtom } from 'jotai'
import { Activity } from 'react'
import { Switch } from '@/components/shadcn/switch'
import { isIgnoreTabAtom } from '../atoms/ignore'
import { isCurrentSiteInWhitelistAtom, isWhitelistModeAtom, toggleCurrentSiteInWhitelistAtom } from '../atoms/site-control'

export function AddToWhitelist() {
  const isCurrentSiteInWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)
  const toggleCurrentSiteInWhitelist = useSetAtom(toggleCurrentSiteInWhitelistAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const isWhitelistMode = useAtomValue(isWhitelistModeAtom)

  return (
    <Activity mode={isWhitelistMode ? 'visible' : 'hidden'}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">
          {i18n.t('popup.addToWhitelist')}
        </span>
        <Switch
          checked={isCurrentSiteInWhitelist}
          onCheckedChange={toggleCurrentSiteInWhitelist}
          disabled={isIgnoreTab}
        />
      </div>
    </Activity>
  )
}
