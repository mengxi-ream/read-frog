import ReadProvider from './read-provider'
import TranslateProvider from './translate-provider'

export default function ProviderConfig() {
  return (
    <section>
      <h2 className="mb-8 text-center text-2xl font-bold">
        {i18n.t('options.providerConfig.title')}
      </h2>
      <ReadProvider />
      <TranslateProvider />
    </section>
  )
}
