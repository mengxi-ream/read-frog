import { i18n } from '#imports'
import { ConfigCard } from '../../components/config-card'
import { RangeSelector } from './components/range-selector'

export default function TranslationConfig() {
  return (
    <ConfigCard title={i18n.t('options.general.translationConfig.title')} description={i18n.t('options.general.translationConfig.description')}>
      <RangeSelector />
    </ConfigCard>
  )
}
