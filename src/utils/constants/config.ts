import { Config } from "@/types/config/config";
import { Provider, ProviderConfig } from "@/types/config/provider";
import openaiLogo from "@/assets/llm/openai.jpg";
import deepseekLogo from "@/assets/llm/deepseek.png";
export const CONFIG_STORAGE_KEY = "config";

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  openai: {
    apiKey: undefined,
    model: "gpt-4.1-mini",
    isCustomModel: false,
    customModel: "",
  },
  deepseek: {
    apiKey: undefined,
    model: "deepseek-chat",
    isCustomModel: false,
    customModel: "",
  },
};

export const DEFAULT_CONFIG: Config = {
  language: {
    detectedCode: "eng",
    sourceCode: "auto",
    targetCode: "cmn",
    level: "intermediate",
  },
  provider: "openai",
  providersConfig: DEFAULT_PROVIDER_CONFIG,
  manualTranslate: {
    enabled: true,
    hotkey: "ctrl",
  },
  floatingButton: {
    enabled: true,
  },
};

export const PROVIDER_ITEMS: Record<Provider, { logo: string; name: string }> =
  {
    openai: {
      logo: openaiLogo,
      name: "OpenAI",
    },
    deepseek: {
      logo: deepseekLogo,
      name: "DeepSeek",
    },
  };
