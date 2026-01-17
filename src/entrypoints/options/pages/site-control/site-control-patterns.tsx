import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'
import { DisabledPatternsTable } from '../../components/disabled-patterns-table'

export function SiteControlPatterns() {
  const [siteControl, setSiteControl] = useAtom(configFieldsAtomMap.siteControl)
  const { patterns = [] } = siteControl

  const addPattern = (pattern: string) => {
    const cleanedPattern = pattern.trim()
    if (!cleanedPattern || patterns.includes(cleanedPattern))
      return

    void setSiteControl({
      ...siteControl,
      patterns: [...patterns, cleanedPattern],
    })
  }

  const removePattern = (pattern: string) => {
    void setSiteControl({
      ...siteControl,
      patterns: patterns.filter(p => p !== pattern),
    })
  }

  return (
    <ConfigCard
      title={i18n.t('options.siteControl.patterns.title')}
      description={i18n.t('options.siteControl.patterns.description')}
    >
      <DisabledPatternsTable
        patterns={patterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t('options.siteControl.patterns.enterUrlPattern')}
        tableHeaderText={i18n.t('options.siteControl.patterns.urlPattern')}
      />
    </ConfigCard>
  )
}
