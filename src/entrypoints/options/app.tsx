import Container from '@/components/container'

import ProviderConfig from './providers'
import TranslationConfigSection from './translation-config'

export default function App() {
  return (
    <Container className="mt-12 max-w-4xl space-y-16">
      <ProviderConfig />
      <TranslationConfigSection />
    </Container>
  )
}
