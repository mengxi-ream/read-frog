import { isAPIProvider, isCustomLLMProvider, isLLMProvider, isNonAPIProvider, isNonCustomLLMProvider, isPureAPIProvider, isPureTranslateProvider, isTranslateProvider, } from "./constants";
export * from "./constants";
export * from "./provider-specific-settings";
export * from "./schemas";
export function isTranslateProviderConfig(config) {
    return isTranslateProvider(config.provider);
}
export function isLLMProviderConfig(config) {
    return isLLMProvider(config.provider);
}
export function isCustomLLMProviderConfig(config) {
    return isCustomLLMProvider(config.provider);
}
export function isNonCustomLLMProviderConfig(config) {
    return isNonCustomLLMProvider(config.provider);
}
export function isAPIProviderConfig(config) {
    return isAPIProvider(config.provider);
}
export function isPureAPIProviderConfig(config) {
    return isPureAPIProvider(config.provider);
}
export function isNonAPIProviderConfig(config) {
    return isNonAPIProvider(config.provider);
}
export function isPureTranslateProviderConfig(config) {
    return isTranslateProvider(config.provider) && isPureTranslateProvider(config.provider);
}
