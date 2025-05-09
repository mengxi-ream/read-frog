import { Config } from "@/types/config/config";
import { DEFAULT_CONFIG, CONFIG_STORAGE_KEY } from "./constants/config";

export async function initializeConfig() {
  await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, DEFAULT_CONFIG);

  if (import.meta.env.DEV) {
    const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`);
    if (config) {
      const newProviderConfig = Object.fromEntries(
        Object.entries(config.providersConfig).map(([provider, cfg]) => {
          const apiKeyEnvName = `WXT_${provider.toUpperCase()}_API_KEY`;
          return [provider, { ...cfg, apiKey: import.meta.env[apiKeyEnvName] }];
        })
      );
      await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
        ...config,
        providersConfig: newProviderConfig,
      });
    }
  }
}
