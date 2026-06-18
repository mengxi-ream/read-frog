import { deepmerge } from "deepmerge-ts";
import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import { llmProviderConfigItemSchema, providerConfigItemSchema } from "@/types/config/provider";
import { getProviderConfigById } from "../config/helpers";
import { FEATURE_PROVIDER_DEFS } from "../constants/feature-providers";
import { configAtom, configFieldsAtomMap } from "./config";
export const featureProviderConfigAtom = atomFamily((featureKey) => atom((get) => {
    const config = get(configAtom);
    const def = FEATURE_PROVIDER_DEFS[featureKey];
    const providerId = def.getProviderId(config);
    return getProviderConfigById(config.providersConfig, providerId) ?? null;
}));
// Generic provider config atom family that accepts a name parameter
export const providerConfigAtom = atomFamily((id) => atom((get) => {
    const providersConfig = get(configFieldsAtomMap.providersConfig);
    return getProviderConfigById(providersConfig, id);
}, async (get, set, newProviderConfig) => {
    const providersConfig = get(configFieldsAtomMap.providersConfig);
    const updatedProviders = providersConfig.map(provider => provider.id === id ? newProviderConfig : provider);
    await set(configFieldsAtomMap.providersConfig, updatedProviders);
}));
function mergeUnknown(base, updates) {
    return deepmerge(base, updates);
}
export function updateLLMProviderConfig(config, updates) {
    const result = mergeUnknown(config, updates);
    return llmProviderConfigItemSchema.parse(result);
}
export function updateProviderConfig(config, updates) {
    const result = mergeUnknown(config, updates);
    return providerConfigItemSchema.parse(result);
}
