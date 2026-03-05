import type { PromptAtoms } from "./context"
import { ConfigCard } from "@/entrypoints/options/components/config-card"
import { PromptConfiguratorContext } from "./context"
import { PromptList } from "./prompt-list"

export type { CustomPromptsConfig, PromptAtoms } from "./context"
export { usePromptAtoms } from "./context"

interface PromptConfiguratorProps {
  id?: string
  promptAtoms: PromptAtoms
  title: string
  description: React.ReactNode
}

export function PromptConfigurator({ id, promptAtoms, title, description }: PromptConfiguratorProps) {
  return (
    <PromptConfiguratorContext value={promptAtoms}>
      <ConfigCard id={id} className="lg:flex-col" title={title} description={description}>
        <PromptList />
      </ConfigCard>
    </PromptConfiguratorContext>
  )
}
