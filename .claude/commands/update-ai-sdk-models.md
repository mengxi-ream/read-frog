Update AI SDK provider models by scraping the latest data from Vercel AI SDK docs and syncing with `LLM_PROVIDER_MODELS`.

You MUST follow every step below in order. Do not skip steps or auto-approve decisions — ask the user when instructed.

---

## Step 1: Scrape

Run the scraper and read the output:

```bash
pnpm scrape:ai-sdk-models
```

Then read `scripts/output/ai-sdk-provider-models.json`. Parse the JSON. Note `meta.totalModels` and `meta.providersSucceeded`. If there are entries in `errors`, warn the user.

## Step 2: Read current state

Read `src/utils/constants/models.ts` and extract all keys from `LLM_PROVIDER_MODELS`.

## Step 3: Match providers

For each key in `LLM_PROVIDER_MODELS`, find a matching provider in the scraped data's `providers` array (each has a `slug` field):

1. **Exact match**: codebase key === scraped slug
2. **Fuzzy match**: scraped slug contains the codebase key, or codebase key contains the scraped slug (e.g., codebase `xai` matches scraped slug `xai`)
3. **No match**: skip this provider (preserve its models as-is)

Present the full mapping table to the user for confirmation before proceeding:

```
Provider Key     → Scraped Slug         (Status)
openai           → openai               ✅ exact
google           → google-generative-ai ✅ fuzzy
openai-compatible → (none)              ⏭️ skip
...
```

Wait for user confirmation. If the user corrects any mapping, apply their corrections.

## Step 4: Compare & update each matched provider

For each matched provider:

1. Collect ALL model names from ALL `tables[].models[].model` entries in the scraped provider
2. Get the current model list from `LLM_PROVIDER_MODELS[key]`
3. Identify:
   - **New models**: in scraped data but not in current list
   - **Missing models**: in current list but not in scraped data

For **new models**: prepend them to the array (newer models first).

For **missing models**: present them to the user and ask whether to remove each one. Some models may be intentionally kept even if not on the AI SDK docs page.

Edit `src/utils/constants/models.ts` to update `LLM_PROVIDER_MODELS` with the changes. Preserve the `as const` assertion and existing formatting style (single quotes, trailing commas).

## Step 5: Check `LLM_MODEL_OPTIONS`

Read the `LLM_MODEL_OPTIONS` array from `src/utils/constants/models.ts`. For each newly added model (from Step 4), check if it matches any existing `pattern` regex in `LLM_MODEL_OPTIONS`.

Report any new models that do NOT match any pattern:

```
⚠️ New models without LLM_MODEL_OPTIONS coverage:
  - openai: o4-mini (no pattern matches)
  - google: gemini-2.5-ultra (matches /^gemini-/ ✅ — never mind)
```

Do NOT auto-edit `LLM_MODEL_OPTIONS`. Only flag for user awareness.

## Step 6: Check `DEFAULT_LLM_PROVIDER_MODELS`

Read `src/utils/constants/providers.ts` and find `DEFAULT_LLM_PROVIDER_MODELS`.

For each provider that had models updated in Step 4, check if its current default `model` value still exists in the updated `LLM_PROVIDER_MODELS` list.

If a default model was **removed** (deprecated):
- Suggest the first model in the updated list as replacement
- Ask the user to confirm before changing

If the default model still exists in the list, do nothing.

## Step 7: Migration script (only if models were removed)

If ANY models were removed in Step 4, you MUST create a config migration script so that users whose active model was removed get migrated to a working default.

### 7a. Bump config version

Read `src/utils/constants/config.ts` and increment `CONFIG_SCHEMA_VERSION` by 1 (e.g., 55 → 56).

### 7b. Create migration script

Create a new file at `src/utils/config/migration-scripts/vXXX-to-vYYY.ts` following the existing naming convention.

**Critical rule**: The migration script must use **hardcoded string literals** for both the removed model names and the replacement default model names. NEVER import or reference runtime variables like `DEFAULT_LLM_PROVIDER_MODELS` or `LLM_PROVIDER_MODELS` — those change with future updates, but a migration is a snapshot of a specific point-in-time transformation.

Template:

```typescript
import type { MigrationFunction } from './types'

// Models removed in this update and their replacement defaults.
// These are intentionally hardcoded — migrations must not depend on
// runtime constants that change across versions.
const REMOVED_MODELS: Record<string, { removed: string[], default: string }> = {
  openai: { removed: ['gpt-4-turbo'], default: 'gpt-5-mini' },
  // ... one entry per provider that had removals
}

export const migrate: MigrationFunction = (oldConfig: any) => {
  const providersConfig = oldConfig.providersConfig
  if (!Array.isArray(providersConfig)) return oldConfig

  const newProvidersConfig = providersConfig.map((provider: any) => {
    const entry = REMOVED_MODELS[provider.provider]
    if (!entry) return provider

    const currentModel = provider.model?.model
    if (currentModel && entry.removed.includes(currentModel)) {
      return {
        ...provider,
        model: {
          ...provider.model,
          model: entry.default,
        },
      }
    }
    return provider
  })

  return { ...oldConfig, providersConfig: newProvidersConfig }
}
```

### 7c. Register the migration

Read `src/utils/config/migration.ts` and add the new migration import and entry to the `migrationScripts` record.

### 7d. Add test data

Follow the existing test pattern in `src/utils/config/__tests__/example/`. Create a new version file with test series covering:
- A provider using a removed model → should be migrated to the default
- A provider using a non-removed model → should be unchanged

## Step 8: Verify

Run type checking:

```bash
pnpm type-check
```

If there are errors related to the changes, fix them. Re-run until clean.

## Step 9: Summary

Print a summary table:

```
Provider     | Added | Removed | Notes
-------------|-------|---------|------
openai       |     3 |       1 | removed: gpt-4-turbo
google       |     2 |       0 |
anthropic    |     0 |       0 | no changes
xai          |     1 |       0 |
(skipped)    |     — |       — | openai-compatible, siliconflow, ...
```

Include total counts at the bottom.
