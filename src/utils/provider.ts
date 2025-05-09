import { createProviderRegistry } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { ProviderConfig } from "@/types/config/provider";

export async function getProviderRegistry() {
  const providerConfig = await storage.getItem<ProviderConfig>(
    `local:providerConfig`
  );

  return createProviderRegistry({
    openai: createOpenAI({
      apiKey: providerConfig?.openai.apiKey,
    }),
    deepseek: createDeepSeek({
      apiKey: providerConfig?.deepseek.apiKey,
    }),
  });
}
