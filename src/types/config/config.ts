import { LangCodeISO6393, LangLevel } from "./languages";
import { ProviderConfig } from "./provider";
import { Provider } from "./provider";

export const hotkey = ["ctrl", "option", "shift", "~"] as const;
export type Hotkey = (typeof hotkey)[number];

export type Config = {
  language: {
    detectedCode: LangCodeISO6393;
    sourceCode: LangCodeISO6393 | "auto";
    targetCode: LangCodeISO6393;
    level: LangLevel;
  };
  provider: Provider;
  providersConfig: ProviderConfig;
  manualTranslate: {
    enabled: boolean;
    hotkey: Hotkey;
  };
  floatingButton: {
    enabled: boolean;
  };
};
