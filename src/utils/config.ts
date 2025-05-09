import { Config, configSchema } from "@/types/config/config";
import { DEFAULT_CONFIG, CONFIG_STORAGE_KEY } from "./constants/config";
import deepmerge from "deepmerge";

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
      })
    );
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...newConfig,
      providersConfig: newProviderConfig,
    });
  }
}
