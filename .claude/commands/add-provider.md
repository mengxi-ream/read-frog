Add a new AI provider to the Read Frog extension: $ARGUMENTS.

`git show 5a3d688f` (the Atlas Cloud provider) is the reference for every file an addition touches. Some of its code has moved since; the checklist below names where each piece lives now.

1. Parse the provider id from the arguments (e.g. "openrouter", "mistral") and check it is not already a key of `LLM_PROVIDER_MODELS`. If the arguments don't give the models, default model, base URL or description, ask the user.
2. Decide how the provider is built:
   - Dedicated: it has its own AI SDK package (`@ai-sdk/<name>` or a community one such as `ai-sdk-ollama`). Look it up with context7 and install it.
   - OpenAI-compatible: no dedicated package. It goes through `@ai-sdk/openai-compatible`, which is already installed, and needs a base URL.
3. `src/utils/constants/models.ts`: add a `LLM_PROVIDER_MODELS` entry. It is a single list of model ids per provider, with no read/translate split. If the ids carry a vendor prefix (Atlas Cloud's `deepseek-ai/deepseek-v4-flash`), check that the matching `LLM_MODEL_OPTIONS` patterns still apply.
4. `src/types/config/provider/constants.ts`: add the id to `TRANSLATE_PROVIDER_TYPES`, `LLM_PROVIDER_TYPES`, `API_PROVIDER_TYPES` and `ALL_PROVIDER_TYPES`, then to `DEDICATED_LLM_PROVIDER_TYPES` (dedicated) or `HOSTED_OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES` (OpenAI-compatible). Add it to `TOP_LEVEL_REASONING_PROVIDER_TYPES` only if its SDK takes a top-level `reasoning` option.
5. `src/types/config/provider/schemas.ts`: add an entry to `llmProviderConfigSchemaList`, extending `baseOpenAICompatibleLLMProviderConfigSchema` for OpenAI-compatible providers or `baseAPIProviderConfigSchema` for dedicated ones (with `...topLevelReasoningConfigSchema` if you added it to that list).
6. Dedicated providers only: import the factory in `src/utils/providers/model.ts` and add it to `DEDICATED_PROVIDER_FACTORY_BY_TYPE`. OpenAI-compatible providers such as atlascloud stay out of that map; `getLanguageModelForConfig` builds them with `createOpenAICompatible`.
7. `src/utils/constants/providers.ts`:
   - `DEFAULT_LLM_PROVIDER_MODELS`: the default model
   - `PROVIDER_ITEMS`: name, website and logo, either from Lobe Icons via `getLobeIconsCDNUrlFn` (`src/utils/logo.ts`) or a local file in `src/assets/providers/`. `apiKeyUrl` and `sponsor` are optional.
   - `DEFAULT_PROVIDER_CONFIG`: id `<provider>-default`, plus `baseURL` for OpenAI-compatible providers
   - `PROVIDER_URL_PLACEHOLDERS`: the base URL shown in the form
   - `DEFAULT_PROVIDER_CONFIG_LIST`: only if the user asks. It seeds fresh installs only; existing users get the provider through a config migration (see `src/utils/config/migration-scripts/v122-to-v123.ts` and `.agents/skills/migration-scripts/SKILL.md`).
8. Options page: the add-provider dialog and provider cards in `src/entrypoints/options/pages/api-providers/providers-config/` read from `PROVIDER_ITEMS` and `PROVIDER_GROUPS`, so most additions need no component changes. Atlas Cloud touched them only for its sponsor badge.
9. Locales: add the description to every `src/locales/*.yml` under `options.apiProviders.providers.description.<camelCase id>`, the key `getDefaultProviderDescription` looks up.
10. Tests: extend the existing suites. `src/utils/constants/__tests__/providers.test.ts` lists the OpenAI-compatible provider types and checks URL placeholders; `src/utils/constants/__tests__/model.test.ts` covers `LLM_MODEL_OPTIONS`; `src/utils/constants/__tests__/config.test.ts` covers the default provider list.
11. Run `pnpm exec wxt prepare` to regenerate the i18n types, then `pnpm type-check` and `SKIP_FREE_API=true pnpm test`.
