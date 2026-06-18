import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { i18n } from "#imports";
import ProviderIcon from "@/components/provider-icon";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, } from "@/components/ui/base-ui/select";
import { isLLMProviderConfig, isPureTranslateProviderConfig } from "@/types/config/provider";
import { PROVIDER_ITEMS } from "@/utils/constants/providers";
import { useTheme } from "../providers/theme-provider";
export default function ProviderSelector({ providers, value, onChange, placeholder, className, selectContentProps, }) {
    const { theme } = useTheme();
    const currentProvider = providers.find(p => p.id === value);
    const hasGrouping = providers.some(isPureTranslateProviderConfig);
    if (hasGrouping) {
        return (_jsx(TranslateGroupedSelect, { providers: providers, currentProvider: currentProvider, onChange: onChange, placeholder: placeholder, className: className, selectContentProps: selectContentProps, theme: theme }));
    }
    return (_jsx(FlatSelect, { providers: providers, currentProvider: currentProvider, onChange: onChange, placeholder: placeholder, className: className, selectContentProps: selectContentProps, theme: theme }));
}
function TranslateGroupedSelect({ providers, currentProvider, onChange, placeholder, className, theme, selectContentProps, }) {
    const llmProviders = providers.filter(isLLMProviderConfig);
    const pureTranslateProviders = providers.filter(isPureTranslateProviderConfig);
    return (_jsxs(Select, { value: currentProvider, onValueChange: (provider) => {
            if (!provider)
                return;
            onChange(provider.id);
        }, itemToStringValue: p => p.id, children: [_jsx(SelectTrigger, { className: className, size: "sm", children: _jsx(SelectValue, { placeholder: placeholder, children: (provider) => (_jsx(ProviderIcon, { logo: PROVIDER_ITEMS[provider.provider].logo(theme), name: provider.name, size: "sm" })) }) }), _jsxs(SelectContent, { className: "min-w-fit", ...selectContentProps, children: [_jsxs(SelectGroup, { children: [_jsx(SelectLabel, { children: i18n.t("translateService.aiTranslator") }), llmProviders.map(provider => (_jsx(SelectItem, { value: provider, children: _jsx(ProviderIcon, { logo: PROVIDER_ITEMS[provider.provider].logo(theme), name: provider.name, size: "sm" }) }, provider.id)))] }), _jsxs(SelectGroup, { children: [_jsx(SelectLabel, { children: i18n.t("translateService.normalTranslator") }), pureTranslateProviders.map(provider => (_jsx(SelectItem, { value: provider, children: _jsx(ProviderIcon, { logo: PROVIDER_ITEMS[provider.provider].logo(theme), name: provider.name, size: "sm" }) }, provider.id)))] })] })] }));
}
function FlatSelect({ providers, currentProvider, onChange, placeholder, className, theme, selectContentProps, }) {
    return (_jsxs(Select, { value: currentProvider, onValueChange: (provider) => {
            if (!provider)
                return;
            onChange(provider.id);
        }, itemToStringValue: p => p.id, disabled: providers.length === 0, children: [_jsx(SelectTrigger, { className: className, size: "sm", children: _jsx(SelectValue, { placeholder: placeholder, children: (provider) => (_jsx(ProviderIcon, { logo: PROVIDER_ITEMS[provider.provider].logo(theme), name: provider.name, size: "sm" })) }) }), _jsx(SelectContent, { className: "min-w-fit", ...selectContentProps, children: _jsx(SelectGroup, { children: providers.map(provider => (_jsx(SelectItem, { value: provider, children: _jsx(ProviderIcon, { logo: PROVIDER_ITEMS[provider.provider].logo(theme), name: provider.name, size: "sm" }) }, provider.id))) }) })] }));
}
