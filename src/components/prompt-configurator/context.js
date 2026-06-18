import { createContext, use } from "react";
export const PromptConfiguratorContext = createContext(null);
export function usePromptAtoms() {
    const promptConfigurator = use(PromptConfiguratorContext);
    if (!promptConfigurator) {
        throw new Error("usePromptAtoms must be used within PromptConfigurator");
    }
    return promptConfigurator.promptAtoms;
}
export function usePromptInsertCells() {
    const promptConfigurator = use(PromptConfiguratorContext);
    if (!promptConfigurator) {
        throw new Error("usePromptInsertCells must be used within PromptConfigurator");
    }
    return promptConfigurator.insertCells;
}
