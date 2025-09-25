import { i18n } from '#imports'
import { Badge } from '@repo/ui/components/badge'
import { Switch } from '@repo/ui/components/switch'
import { useAtom } from 'jotai'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function BetaExperienceConfig() {
  const [betaExperienceConfig, setBetaExperienceConfig] = useAtom(configFieldsAtomMap.betaExperience)

  return (
    <ConfigCard
      title={(
        <div className="flex items-center gap-2">
          {i18n.t('options.betaExperience.title')}
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            Beta
          </Badge>
        </div>
      )}
      description={i18n.t('options.betaExperience.description')}
    >
      <div className="w-full flex justify-end">
        <Switch
          checked={betaExperienceConfig.enabled}
          onCheckedChange={(checked) => {
            void setBetaExperienceConfig({
              enabled: checked,
            })
          }}
        />
      </div>
    </ConfigCard>
  )
}
