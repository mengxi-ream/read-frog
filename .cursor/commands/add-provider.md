# Add AI Provider

Add a new AI provider to the Read Frog extension: $ARGUMENTS.

Follow these steps:

1. Parse the provider name from the arguments (e.g., "openrouter", "anthropic", "mistral")
2. Install the provider's AI SDK package from vercel ai sdk if available (check for dedicated packages like @openrouter/ai-sdk-provider). If no dedicated package is available, use @ai-sdk/openai-compatible.
3. Update type definitions in `src/types/config/provider.ts`:
   - Add models to READ_PROVIDER_MODELS and TRANSLATE_PROVIDER_MODELS, you can search from docs of Vercel AI SDK, read models need Object Generation capabilities, translate models need Text Generation (Chat) capabilities
   - Add provider to all relevant name arrays
   - Add schema configuration
4. Update provider implementation in `src/utils/providers/model.ts`:
   - Import the provider's create function
   - Add to ProviderFactoryMap interface and CREATE_AI_MAPPER
5. Update constants in `src/utils/constants/providers.ts`:
   - Add default models configuration
   - Add provider config with name, description, baseURL (if needed)
   - Add to PROVIDER_ITEMS with logo from Lobe icons
6. Add i18n translations in all locale files (src/locales/*.yml):
   - Add provider description under options.apiProviders.providers.description
7. Run `pnpm dev` to generate type for i18n first, then `pnpm type-check` type check to ensure no TypeScript errors
8. Ask user for specific models and configuration details if not provided

Common provider patterns:
- Standard API providers: Use official @ai-sdk packages, no custom baseURL needed
- Custom providers: Use @ai-sdk/openai-compatible, require baseURL configuration
- Dedicated packages: Use provider-specific packages (like @openrouter/ai-sdk-provider)

Example models to suggest:
- OpenRouter: read="deepseek/deepseek-chat-v3.1:free", translate="x-ai/grok-4-fast:free"
- Anthropic: read="claude-3-5-sonnet-20241022", translate="claude-3-5-haiku-20241022"
- Mistral: read="mistral-large-latest", translate="mistral-small-latest"
