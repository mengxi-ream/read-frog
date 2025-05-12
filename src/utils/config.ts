import deepmerge from "deepmerge";

import { Config, configSchema } from "@/types/config/config";

import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "./constants/config";

export let globalConfig: Config | null = null;
export const loadGlobalConfigPromise = loadGlobalConfig();

export async function initializeConfig() {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`);
  const newConfig: Config =
    config && configSchema.safeParse(config).success
      ? deepmerge(config, DEFAULT_CONFIG)
      : DEFAULT_CONFIG;
  await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, newConfig);

  if (import.meta.env.DEV) {
    const newProviderConfig = Object.fromEntries(
      Object.entries(newConfig.providersConfig).map(([provider, cfg]) => {
        const apiKeyEnvName = `WXT_${provider.toUpperCase()}_API_KEY`;
        return [provider, { ...cfg, apiKey: import.meta.env[apiKeyEnvName] }];
      }),
    );
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...newConfig,
      providersConfig: newProviderConfig,
    });
  }
}

export async function loadGlobalConfig() {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`);
  if (configSchema.safeParse(config).success) {
    globalConfig = config;
  } else {
    await initializeConfig();
    globalConfig = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`);
  }
}

storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (newConfig) => {
  if (configSchema.safeParse(newConfig).success) {
    globalConfig = newConfig;
  }
});
