import APIKeyConfig from './api-key-config'
import BaseURLConfig from './base-url-config'
import ReadProvider from './read-provider'
import TranslateProvider from './translate-provider'

export default function ProviderConfig() {
  return (
    <section>
      <h2 className="mb-8 text-2xl font-bold">
        {i18n.t('options.providerConfig.title')}
      </h2>
      <div className="space-y-12">
        <ReadProvider />
        <TranslateProvider />
        <APIKeyConfig />
        <BaseURLConfig />
      </div>
    </section>
  )
}
