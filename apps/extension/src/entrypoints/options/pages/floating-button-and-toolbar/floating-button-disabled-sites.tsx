import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'
import { DisabledPatternsTable } from '../../components/disabled-patterns-table'

export function FloatingButtonDisabledSites() {
  const [floatingButtonConfig, setFloatingButtonConfig] = useAtom(configFieldsAtomMap.floatingButton)
  const { disabledFloatingButtonPatterns = [] } = floatingButtonConfig

  const addPattern = (pattern: string) => {
    const cleanedPattern = pattern.trim()
    if (!cleanedPattern || disabledFloatingButtonPatterns.includes(cleanedPattern))
      return

    void setFloatingButtonConfig({
      ...floatingButtonConfig,
      disabledFloatingButtonPatterns: [...disabledFloatingButtonPatterns, cleanedPattern],
    })
  }

  const removePattern = (pattern: string) => {
    void setFloatingButtonConfig({
      ...floatingButtonConfig,
      disabledFloatingButtonPatterns: disabledFloatingButtonPatterns.filter(p => p !== pattern),
    })
  }

  return (
    <ConfigCard
      title={i18n.t('options.floatingButtonAndToolbar.floatingButton.disabledSites.title')}
      description={i18n.t('options.floatingButtonAndToolbar.floatingButton.disabledSites.description')}
    >
      <DisabledPatternsTable
        patterns={disabledFloatingButtonPatterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t('options.floatingButtonAndToolbar.floatingButton.disabledSites.enterUrlPattern')}
        tableHeaderText={i18n.t('options.floatingButtonAndToolbar.floatingButton.disabledSites.urlPattern')}
      />
    </ConfigCard>
  )
}
