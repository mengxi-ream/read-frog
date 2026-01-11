import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { Label } from '@/components/shadcn/label'
import { RadioGroup, RadioGroupItem } from '@/components/shadcn/radio-group'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function SiteControlMode() {
  const [siteControl, setSiteControl] = useAtom(configFieldsAtomMap.siteControl)

  return (
    <ConfigCard
      title={i18n.t('options.siteControl.mode.title')}
      description={i18n.t('options.siteControl.mode.description')}
    >
      <RadioGroup
        value={siteControl.mode}
        onValueChange={(value: 'all' | 'whitelist') => {
          void setSiteControl({
            ...siteControl,
            mode: value,
          })
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="mode-all" />
          <Label htmlFor="mode-all" className="cursor-pointer">
            {i18n.t('options.siteControl.mode.all')}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="whitelist" id="mode-whitelist" />
          <Label htmlFor="mode-whitelist" className="cursor-pointer">
            {i18n.t('options.siteControl.mode.whitelist')}
          </Label>
        </div>
      </RadioGroup>
    </ConfigCard>
  )
}
