import { createProviderRegistry } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { Config } from "@/types/config/config";
import { CONFIG_STORAGE_KEY } from "./constants/config";

export async function getProviderRegistry() {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`);

  console.log("storage config", config);

  return createProviderRegistry({
    openai: createOpenAI({
      apiKey: config?.providersConfig?.openai.apiKey,
    }),
    deepseek: createDeepSeek({
      apiKey: config?.providersConfig?.deepseek.apiKey,
    }),
  });
}
