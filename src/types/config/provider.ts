import { z } from "zod";

/* ──────────────────────────────
   1.  Single source‑of‑truth
   ────────────────────────────── */
export const providerModels = {
  openai: ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-nano"],
  deepseek: ["deepseek-chat"],
} as const;

const providerNames = ["openai", "deepseek"] as const satisfies Readonly<
  (keyof typeof providerModels)[]
>;

/* ──────────────────────────────
   2. providerSchema
   ────────────────────────────── */
export const providerSchema = z.enum(providerNames);
export type Provider = z.infer<typeof providerSchema>;

/* ──────────────────────────────
   3. providersConfigSchema
   ────────────────────────────── */
type ModelTuple = readonly [string, ...string[]]; // 至少一个元素才能给 z.enum
const providerConfigSchema = <T extends ModelTuple>(models: T) =>
  z.object({
    apiKey: z.string().optional(),
    model: z.enum(models),
    isCustomModel: z.boolean(),
    customModel: z.string().optional(),
  });

type SchemaShape<M extends Record<string, ModelTuple>> = {
  [K in keyof M]: ReturnType<typeof providerConfigSchema<M[K]>>;
};
const buildSchema = <M extends Record<string, ModelTuple>>(models: M) =>
  z.object(
    // 用 reduce 而不用 Object.fromEntries ➙ 保留键名/类型
    (Object.keys(models) as (keyof M)[]).reduce((acc, key) => {
      acc[key] = providerConfigSchema(models[key]);
      return acc;
    }, {} as SchemaShape<M>)
  );

export const providersConfigSchema = buildSchema(providerModels);
export type ProvidersConfig = z.infer<typeof providersConfigSchema>;

// 为每个provider生成对应的模型类型
export type ProviderToModel = {
  [P in Provider]: (typeof providerModels)[P][number];
};

// 通用Model类型
export type Model = ProviderToModel[Provider];

// 为特定provider获取模型类型
export type ModelForProvider<P extends Provider> = ProviderToModel[P];

// 生成ProviderConfig类型
// export type ProviderConfig = {
//   [P in Provider]: {
//     apiKey: string | undefined;
//     model: ModelForProvider<P>;
//     isCustomModel: boolean;
//     customModel: string;
//   };
// };

// 为了向后兼容，保留这些类型定义
// export type OpenAIModel = ModelForProvider<"openai">;
// export type DeepseekModel = ModelForProvider<"deepseek">;
