import { jsx as _jsx } from "react/jsx-runtime";
import { ConfigCard } from "@/entrypoints/options/components/config-card";
import { PromptConfiguratorContext } from "./context";
import { PromptList } from "./prompt-list";
export { usePromptAtoms } from "./context";
export function PromptConfigurator({ id, promptAtoms, insertCells, title, description }) {
    return (_jsx(PromptConfiguratorContext, { value: { promptAtoms, insertCells }, children: _jsx(ConfigCard, { id: id, className: "lg:flex-col", title: title, description: description, children: _jsx(PromptList, {}) }) }));
}
