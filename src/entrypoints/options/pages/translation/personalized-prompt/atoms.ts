import { createPromptAtoms } from "@/components/prompt-configurator/create-atoms"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export const promptAtoms = createPromptAtoms(configFieldsAtomMap.translate)
