import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { i18n } from "#imports";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, } from "@/components/ui/base-ui/combobox";
import { filterLanguage, getLanguageItems } from "./language-combobox-options";
function AutoBadge() {
    return _jsx("span", { className: "rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800", children: "auto" });
}
export function LanguageCombobox({ value, onValueChange, detectedLangCode, placeholder, className, }) {
    const languageItems = useMemo(() => getLanguageItems(detectedLangCode), [detectedLangCode]);
    return (_jsxs(Combobox, { value: languageItems.find(item => item.value === value) ?? null, onValueChange: (item) => {
            if (item)
                onValueChange(item.value);
        }, items: languageItems, filter: filterLanguage, autoHighlight: true, children: [_jsx(ComboboxInput, { className: className, placeholder: placeholder ?? i18n.t("translationHub.searchLanguages") }), _jsxs(ComboboxContent, { className: "w-fit", children: [_jsx(ComboboxList, { children: (item) => (_jsxs(ComboboxItem, { value: item, children: [item.label, item.value === "auto" && _jsx(AutoBadge, {})] }, item.value)) }), _jsx(ComboboxEmpty, { children: i18n.t("translationHub.noLanguagesFound") })] })] }));
}
