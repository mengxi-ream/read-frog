import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Icon } from "@iconify/react";
import { langCodeISO6393Schema } from "@read-frog/definitions";
import { useMemo } from "react";
import { i18n } from "#imports";
import { Button } from "@/components/ui/base-ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, } from "@/components/ui/base-ui/combobox";
import { getLanguageLabel } from "@/utils/language-labels";
import { filterLanguage } from "./language-combobox-options";
function getLanguageItems() {
    return langCodeISO6393Schema.options.map(code => ({
        value: code,
        label: getLanguageLabel(code),
    }));
}
export function MultiLanguageCombobox({ selectedLanguages, onLanguagesChange, buttonLabel, }) {
    const languageItems = useMemo(() => getLanguageItems(), []);
    const selectedItems = useMemo(() => languageItems.filter(item => selectedLanguages.includes(item.value)), [languageItems, selectedLanguages]);
    return (_jsxs(Combobox, { multiple: true, value: selectedItems, onValueChange: (items) => {
            onLanguagesChange(items.map(item => item.value));
        }, items: languageItems, filter: filterLanguage, children: [_jsxs(ComboboxPrimitive.Trigger, { render: _jsx(Button, { variant: "outline", className: "w-40 justify-between" }), children: [_jsx("span", { className: "truncate", children: buttonLabel }), _jsx(Icon, { icon: "tabler:chevron-down", className: "text-muted-foreground" })] }), _jsxs(ComboboxContent, { align: "end", className: "w-fit", children: [_jsx(ComboboxInput, { showTrigger: false, placeholder: i18n.t("translationHub.searchLanguages") }), _jsx(ComboboxList, { children: (item) => (_jsx(ComboboxItem, { value: item, children: item.label }, item.value)) }), _jsx(ComboboxEmpty, { children: i18n.t("translationHub.noLanguagesFound") })] })] }));
}
