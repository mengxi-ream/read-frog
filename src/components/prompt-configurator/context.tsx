import type { PrimitiveAtom, WritableAtom } from "jotai"
import type { z } from "zod"
import type { customPromptsConfigSchema } from "@/types/config/translate"
import { createContext, use } from "react"

export type CustomPromptsConfig = z.infer<typeof customPromptsConfigSchema>
export interface PromptInsertCell {
  text: string
  description: string
}

export interface PromptAtoms {
  config: WritableAtom<CustomPromptsConfig, [CustomPromptsConfig], void>
  exportMode: PrimitiveAtom<boolean>
  selectedPrompts: PrimitiveAtom<string[]>
}

export interface PromptConfiguratorContextValue {
  promptAtoms: PromptAtoms
  insertCells: PromptInsertCell[]
}

export const PromptConfiguratorContext = createContext<PromptConfiguratorContextValue | null>(null)

export function usePromptAtoms() {
  const promptConfigurator = use(PromptConfiguratorContext)
  if (!promptConfigurator) {
    throw new Error("usePromptAtoms must be used within PromptConfigurator")
  }
  return promptConfigurator.promptAtoms
}

export function usePromptInsertCells() {
  const promptConfigurator = use(PromptConfiguratorContext)
  if (!promptConfigurator) {
    throw new Error("usePromptInsertCells must be used within PromptConfigurator")
  }
  return promptConfigurator.insertCells
}
