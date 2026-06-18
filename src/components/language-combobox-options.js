import { langCodeISO6393Schema } from "@read-frog/definitions";
import { getLanguageLabel, getLanguageName } from "@/utils/language-labels";
export function getTargetLanguageItems() {
    return langCodeISO6393Schema.options.map(code => ({
        value: code,
        label: getLanguageLabel(code),
        name: getLanguageName(code),
    }));
}
export function getLanguageItems(detectedLangCode) {
    const items = getTargetLanguageItems();
    if (detectedLangCode) {
        items.unshift({
            value: "auto",
            label: getLanguageLabel(detectedLangCode),
            name: getLanguageName(detectedLangCode),
        });
    }
    return items;
}
export function filterLanguage(item, query) {
    const searchLower = query.toLowerCase();
    return item.label.toLowerCase().includes(searchLower)
        || (item.name?.toLowerCase().includes(searchLower) ?? false)
        || item.value.toLowerCase().includes(searchLower);
}
