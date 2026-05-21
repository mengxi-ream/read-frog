# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Read Frog is an open-source browser extension for AI-powered language learning. It provides immersive translation, selection translation, subtitle translation (YouTube), text-to-speech, and 20+ AI provider support. Built with WXT (Web Extension framework), React 19, and TypeScript. Targets Chrome, Edge, and Firefox (MV3).

## Commands

```bash
pnpm install              # Install dependencies (runs wxt prepare as postinstall)
pnpm dev                  # Start dev server (Chrome, port 3333)
pnpm dev:edge             # Dev server for Edge
pnpm dev:firefox          # Dev server for Firefox MV3
pnpm dev:local            # Dev with local monorepo packages (WXT_USE_LOCAL_PACKAGES=true)
pnpm build                # Production build (Chrome)
pnpm build:edge           # Production build (Edge)
pnpm build:firefox        # Production build (Firefox MV3)
pnpm test                 # Run all tests (vitest)
pnpm test:watch           # Run tests in watch mode
pnpm test:cov             # Run tests with coverage
pnpm lint                 # ESLint check
pnpm lint:fix             # ESLint with auto-fix
pnpm type-check           # TypeScript type check (tsc --noEmit)
```

Run a single test file: `pnpm vitest run src/utils/__tests__/some-file.test.ts`
Run tests matching a pattern: `pnpm vitest run -t "test name pattern"`

Set `SKIP_FREE_API=true` when running tests locally to skip live external translation service tests.

## Architecture

### Extension Entry Points (WXT)

Each entry point in `src/entrypoints/` maps to a distinct browser extension context:

| Entrypoint             | Context                     | Purpose                                                                                             |
| ---------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `background/`          | Service worker              | Central message hub, translation queues, proxy fetch, TTS orchestration, config init, context menus |
| `host.content/`        | Content script (page)       | Injects translation UI into web pages, manages page-level translation state                         |
| `selection.content/`   | Content script (page)       | Selection toolbar + input translation overlay for selected text                                     |
| `side.content/`        | Content script (page)       | Floating button that opens the side panel                                                           |
| `interceptor.content/` | Content script (MAIN world) | YouTube player API injection (runs in page's JS context)                                            |
| `subtitles.content/`   | Content script (page)       | YouTube subtitle translation overlay                                                                |
| `popup/`               | Browser action popup        | Quick access popup UI                                                                               |
| `options/`             | Full-page options           | Settings pages (API providers, translation, TTS, subtitles, custom actions, etc.)                   |
| `sidepanel/`           | Side panel                  | Side panel container                                                                                |
| `translation-hub/`     | Extension page              | Translation hub page                                                                                |
| `offscreen/`           | Offscreen document          | Audio playback for TTS (Chrome requires offscreen for audio)                                        |

Content scripts with `.content` suffix run in web page contexts. They mount React apps into shadow DOM hosts to avoid CSS conflicts with the page.

### Message Bus

All cross-context communication uses `@webext-core/messaging` via `src/utils/message.ts`. The `ProtocolMap` interface defines all message types. Background handles most messages; content scripts send messages to background for operations like translation, proxy fetch, and TTS.

### State Management

- **Jotai atoms** (`src/utils/atoms/`) — Primary reactive state: config, translation state, provider, theme, analytics. Each atom file has a corresponding `__tests__/` directory.
- **Dexie (IndexedDB)** (`src/utils/db/dexie/`) — Persistent storage for config with migration support. `app-db.ts` defines the database; `migration.ts` and `migration-scripts/` handle schema evolution.
- **TanStack Query** (`src/utils/tanstack-query.ts`) — Server state via oRPC client (`src/utils/orpc/client.ts`). Proxies all fetch calls through background to avoid CORS in content scripts.
- **Extension storage** (`chrome.storage.local`) — Used via Jotai atoms with `storageAdapter`.

### Translation Pipeline

The page translation system in `src/utils/host/` is the core feature:

- `host/dom/` — DOM traversal, node filtering, batch DOM operations for finding/inserting translation nodes
- `host/translate/core/` — Core translation logic (node manipulation, text preparation, translation attributes)
- `host/translate/dom/` — DOM-level translation rendering
- `host/translate/api/` — AI API calls for translation (free APIs + LLM providers)
- `host/translate/ui/` — Translation UI overlays in the page
- `host/translate/auto-translation.ts` — Auto-translation trigger logic

Background manages translation queues (`translation-queues.ts`) with priority queuing (`src/utils/request/`) and batch request support to reduce API costs.

### AI Providers

20+ providers via Vercel AI SDK (`@ai-sdk/*` packages). Provider config types in `src/types/config/provider/`. Provider utilities in `src/utils/providers/` (model ID mapping, headers, options). Provider models are scraped via `scripts/scrape-ai-sdk-provider-models.ts`.

### Key Patterns

- **Shadow DOM isolation**: Content scripts mount React into shadow roots (`src/utils/react-shadow-host/`). Styles must be injected into shadow roots, not document head.
- **Config system**: Zod-validated config schema (`src/types/config/config.ts`). Default config in `src/utils/constants/`. Config atom syncs to IndexedDB via storage adapter. Migration scripts handle config schema changes.
- **i18n**: WXT i18n module with locale YAML files in `src/locales/` (en, zh-CN, zh-TW, ja, ko, es, ru, tr, vi).
- **Environment**: `src/env/` uses `@t3-oss/env-core` with Zod validation. Production requires `WXT_GOOGLE_CLIENT_ID`, `WXT_POSTHOG_HOST`, `WXT_POSTHOG_API_KEY`. Local dev uses localhost defaults.
- **oRPC**: Typed RPC between extension and backend server (`@read-frog/api-contract`). All fetches proxy through background script for CORS avoidance.

## Code Style

- ESLint: `@antfu/eslint-config` with double quotes, CSS/HTML/Markdown formatting via Prettier
- Import sorting: `perfectionist/sort-imports` with custom groups (zod-config setup imports first)
- Test style: `test/consistent-test-it` (use `it` not `test`), `test/no-identical-title`
- TanStack Query rules: `exhaustive-deps`, `no-rest-destructuring`, `stable-query-client`
- Commit messages: Conventional commits with extended types (`i18n`, `ai` allowed)
- React 19: `react/no-implicit-key` is off (key no longer in props in React 19)
- No `unused-imports/no-unused-imports` — removed imports are an error

## Testing

Tests live in `__tests__/` directories colocated with source. Vitest with jsdom/node environment, globals enabled. Coverage via Istanbul. WxtVitest plugin provides extension API mocks.

## Dual License

GPLv3 + commercial license by FEELIO TECHNOLOGIES LTD. Contributors must agree to dual licensing (see CONTRIBUTING.md). The Meituan Tabbit team has a free commercial license for versions up to v1.21.3.
