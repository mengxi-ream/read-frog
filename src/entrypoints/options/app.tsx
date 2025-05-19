import Container from '@/components/container'

import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import ProviderConfig from './providers'
import TranslationConfigSection from './translation-config'

export default function App() {
  return (
    <Container className="max-w-7xl">
      <header className="flex h-16 -ml-1.5 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-1.5 h-4!" />
        <h1>Options</h1>
      </header>
      <ProviderConfig />
      <TranslationConfigSection />
    </Container>
  )
}
