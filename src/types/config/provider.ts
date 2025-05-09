// 定义一个映射对象，包含所有的provider及其对应的模型
export const providerModels = {
  openai: ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-nano"],
  deepseek: ["deepseek-chat"],
} as const;

// 从映射对象中提取provider类型
export const providers = Object.keys(providerModels) as Provider[];
export type Provider = keyof typeof providerModels;

// 为每个provider生成对应的模型类型
export type ProviderToModel = {
  [P in Provider]: (typeof providerModels)[P][number];
};

// 通用Model类型
export type Model = ProviderToModel[Provider];

// 为特定provider获取模型类型
export type ModelForProvider<P extends Provider> = ProviderToModel[P];

// 生成ProviderConfig类型
export type ProviderConfig = {
  [P in Provider]: {
    apiKey: string | undefined;
    model: ModelForProvider<P>;
    isCustomModel: boolean;
    customModel: string;
  };
};

// 为了向后兼容，保留这些类型定义
export type OpenAIModel = ModelForProvider<"openai">;
export type DeepseekModel = ModelForProvider<"deepseek">;
