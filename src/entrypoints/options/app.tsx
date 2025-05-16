import Container from '@/components/container'

import ProviderConfigSection from './provider-config'
import TranslationConfigSection from './translation-config'

export default function App() {
  return (
    <Container className="mt-12 max-w-4xl space-y-16">
      <ProviderConfigSection />
      <TranslationConfigSection />
    </Container>
  )
}
