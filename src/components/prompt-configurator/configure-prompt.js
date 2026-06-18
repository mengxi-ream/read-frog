import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from "@iconify/react";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { i18n } from "#imports";
import { Button } from "@/components/ui/base-ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field";
import { Input } from "@/components/ui/base-ui/input";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger, } from "@/components/ui/base-ui/sheet";
import { QuickInsertableTextarea } from "@/components/ui/insertable-textarea";
import { DEFAULT_TRANSLATE_PROMPT_ID } from "@/utils/constants/prompt";
import { getRandomUUID } from "@/utils/crypto-polyfill";
import { cn } from "@/utils/styles/utils";
import { usePromptAtoms, usePromptInsertCells } from "./context";
export function ConfigurePrompt({ originPrompt, className, ...props }) {
    const promptAtoms = usePromptAtoms();
    const insertCells = usePromptInsertCells();
    const [config, setConfig] = useAtom(promptAtoms.config);
    const isExportMode = useAtomValue(promptAtoms.exportMode);
    const inEdit = !!originPrompt;
    const isDefault = originPrompt?.id === DEFAULT_TRANSLATE_PROMPT_ID;
    const defaultPrompt = { id: getRandomUUID(), name: "", systemPrompt: "", prompt: "" };
    const initialPrompt = originPrompt ?? defaultPrompt;
    const [prompt, setPrompt] = useState(initialPrompt);
    const resetPrompt = () => {
        setPrompt(originPrompt ?? defaultPrompt);
    };
    const sheetTitle = isDefault
        ? i18n.t("options.translation.personalizedPrompts.default")
        : inEdit
            ? i18n.t("options.translation.personalizedPrompts.editPrompt.title")
            : i18n.t("options.translation.personalizedPrompts.addPrompt");
    const clearCachePrompt = () => {
        setPrompt({
            id: getRandomUUID(),
            name: "",
            systemPrompt: "",
            prompt: "",
        });
    };
    const configurePrompt = () => {
        const _patterns = config.patterns;
        setConfig({
            ...config,
            patterns: inEdit
                ? _patterns.map(p => p.id === prompt.id ? prompt : p)
                : [..._patterns, prompt],
        });
        clearCachePrompt();
    };
    return (_jsxs(Sheet, { onOpenChange: (open) => {
            if (open) {
                resetPrompt();
            }
        }, children: [inEdit
                ? (_jsx(SheetTrigger, { render: _jsx(Button, { variant: "ghost", className: cn("size-8", className), disabled: isExportMode, ...props }), children: _jsx(Icon, { icon: isDefault ? "tabler:eye" : "tabler:pencil", className: "size-4" }) }))
                : (_jsxs(SheetTrigger, { render: _jsx(Button, { className: className, ...props }), children: [_jsx(Icon, { icon: "tabler:plus", className: "size-4" }), i18n.t("options.translation.personalizedPrompts.addPrompt")] })), _jsxs(SheetContent, { className: "w-[400px] sm:w-[500px] sm:max-w-none", children: [_jsx(SheetHeader, { children: _jsx(SheetTitle, { children: sheetTitle }) }), _jsxs(FieldGroup, { className: "flex-1 overflow-y-auto px-4", children: [_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: "prompt-name", children: i18n.t("options.translation.personalizedPrompts.editPrompt.name") }), _jsx(Input, { id: "prompt-name", value: prompt.name, disabled: isDefault, onChange: (e) => {
                                            setPrompt({
                                                ...prompt,
                                                name: e.target.value,
                                            });
                                        } })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: "system-prompt", children: i18n.t("options.translation.personalizedPrompts.editPrompt.systemPrompt") }), _jsx(QuickInsertableTextarea, { value: prompt.systemPrompt, className: "min-h-40 max-h-80", disabled: isDefault, onChange: (e) => setPrompt({ ...prompt, systemPrompt: e.target.value }), insertCells: insertCells })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: "prompt", children: i18n.t("options.translation.personalizedPrompts.editPrompt.prompt") }), _jsx(QuickInsertableTextarea, { value: prompt.prompt, className: "max-h-60", disabled: isDefault, onChange: (e) => setPrompt({ ...prompt, prompt: e.target.value }), insertCells: insertCells })] })] }), !isDefault && (_jsxs(SheetFooter, { children: [_jsx(SheetClose, { render: _jsx(Button, { onClick: configurePrompt }), children: i18n.t("options.translation.personalizedPrompts.editPrompt.save") }), _jsx(SheetClose, { render: _jsx(Button, { variant: "outline" }), children: i18n.t("options.translation.personalizedPrompts.editPrompt.close") })] }))] })] }));
}
