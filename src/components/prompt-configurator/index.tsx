import type { PromptAtoms } from './context'
import { ConfigCard } from '@/entrypoints/options/components/config-card'
import { PromptConfiguratorContext } from './context'
import { PromptList } from './prompt-list'

export type { CustomPromptsConfig, PromptAtoms } from './context'
export { usePromptAtoms } from './context'

interface PromptConfiguratorProps {
  atoms: PromptAtoms
  title: string
  description: React.ReactNode
}

export function PromptConfigurator({ atoms, title, description }: PromptConfiguratorProps) {
  return (
    <PromptConfiguratorContext value={atoms}>
      <ConfigCard className="lg:flex-col" title={title} description={description}>
        <PromptList />
      </ConfigCard>
    </PromptConfiguratorContext>
  )
}
