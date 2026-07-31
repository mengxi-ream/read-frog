import type { PromptAtoms, PromptInsertCell } from "./context"
import { ConfigCard } from "@/entrypoints/options/components/config-card"
import { PromptConfiguratorContext } from "./context"
import { PromptList } from "./prompt-list"

export type { CustomPromptsConfig, PromptAtoms } from "./context"
export { usePromptAtoms } from "./context"

interface PromptManagerProps {
  promptAtoms: PromptAtoms
  insertCells: PromptInsertCell[]
  /** Rendered at the start of the toolbar row, opposite the buttons. */
  toolbarStart?: React.ReactNode
}

/**
 * The prompt list with its import/export/add toolbar, wired to one config field. Carries no
 * heading of its own — the caller frames it, as a card or as a page it drilled into.
 */
export function PromptManager({ promptAtoms, insertCells, toolbarStart }: PromptManagerProps) {
  return (
    <PromptConfiguratorContext value={{ promptAtoms, insertCells }}>
      <PromptList toolbarStart={toolbarStart} />
    </PromptConfiguratorContext>
  )
}

interface PromptConfiguratorProps extends PromptManagerProps {
  id?: string
  title: string
  description: React.ReactNode
}

/** `PromptManager` framed as a `ConfigCard`, for pages that still lay out in cards. */
export function PromptConfigurator({
  id,
  promptAtoms,
  insertCells,
  title,
  description,
}: PromptConfiguratorProps) {
  return (
    <ConfigCard id={id} className="lg:flex-col" title={title} description={description}>
      <PromptManager promptAtoms={promptAtoms} insertCells={insertCells} />
    </ConfigCard>
  )
}
