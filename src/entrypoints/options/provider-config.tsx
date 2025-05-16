import { providerSchema } from '@/types/config/provider'

import { ProviderConfigCard } from './components/provider-config-card'

export default function ProviderConfigSection() {
  return (
    <section>
      <h2 className="mb-8 text-center text-2xl font-bold">
        {i18n.t('options.providerConfig.title')}
      </h2>
      <div className="flex flex-wrap justify-center gap-8">
        {providerSchema.options.map(provider => (
          <ProviderConfigCard key={provider} provider={provider} />
        ))}
      </div>
    </section>
  )
}
