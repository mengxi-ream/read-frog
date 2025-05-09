import { HotkeyConfig } from "@/types/config/config";

// 全局配置存储对象
type ConfigStore = {
  hotkey: HotkeyConfig;
  // 可以在这里添加其他配置
};

// 默认配置值
const defaultHotkey: HotkeyConfig = {
  enabled: false,
  hotkey: "shift", // 修正为合法的值
};

// 全局配置对象
export const configStore: ConfigStore = {
  hotkey: { ...defaultHotkey },
};

// 加载配置的函数
export async function loadConfig() {
  try {
    // 加载hotkey配置
    const hotkey = await storage.getItem("local:hotkeyConfig");
    if (hotkey) {
      configStore.hotkey = hotkey as HotkeyConfig;
    }

    // 在这里可以加载其他配置

    return configStore;
  } catch (error) {
    console.error("Failed to load configs:", error);
    return configStore;
  }
}

// 获取某项具体配置的简便方法
export function getHotkey(): HotkeyConfig {
  return configStore.hotkey;
}

// 如果需要保存修改后的配置
export async function saveHotkey(config: HotkeyConfig) {
  configStore.hotkey = config;
  await storage.setItem("local:hotkeyConfig", config);
}
