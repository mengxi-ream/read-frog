# WXT - Config

## wxt.config.ts

The main config file for WXT projects. All options are optional.

```ts
import { defineConfig } from 'wxt';
import { resolve } from 'node:path';

export default defineConfig({
  // Source directory (default: ".")
  srcDir: 'src',
  // Output directory (default: ".output")
  outDir: 'dist',
  // Modules dir relative to root (default: "modules")
  modulesDir: 'wxt-modules',
  // Public dir (default: "public")
  publicDir: 'static',
  // Entrypoints dir relative to srcDir (default: "entrypoints")
  entrypointsDir: 'entries',

  // WXT modules
  modules: ['@wxt-dev/module-vue'],

  // Manifest config (static object or function)
  manifest: {
    name: 'My Extension',
    permissions: ['storage', 'tabs'],
    host_permissions: ['https://example.com/*'],
  },

  // Vite config override (same as defineConfig({...}) in vite.config.ts)
  vite: () => ({
    plugins: [],
  }),

  // Auto-imports config (unimport options, or false to disable)
  imports: {
    eslintrc: { enabled: 9 },
  },

  // TSConfig path aliases (adds to both bundler and .wxt/tsconfig.json)
  alias: {
    testing: resolve('utils/testing'),
    strings: resolve('utils/strings.ts'),
  },

  // Build hooks
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      if (wxt.config.mode === 'development') {
        manifest.name += ' (DEV)';
      }
    },
  },

  // web-ext config (browser startup), can also be in web-ext.config.ts
  webExt: {
    binaries: { chrome: '/path/to/chrome-beta' },
  },
});
```

## Manifest Config

WXT generates `manifest.json` from `wxt.config.ts`, entrypoints, modules, and hooks. There is no `manifest.json` in source. Output goes to `.output/{target}/manifest.json`.

### MV2/MV3 Auto-conversion

Always define manifest properties in MV3 format. WXT automatically converts to MV2 equivalents when targeting MV2:

```ts
export default defineConfig({
  manifest: {
    // MV3 format — WXT converts to browser_action for MV2
    action: { default_title: 'Some Title' },
    // MV3 format — WXT strips the matches wrapper for MV2
    web_accessible_resources: [
      { matches: ['*://*.google.com/*'], resources: ['icon/*.png'] },
    ],
  },
});
```

MV2 output:
```json
{
  "manifest_version": 2,
  "browser_action": { "default_title": "Some Title" },
  "web_accessible_resources": ["icon/*.png"]
}
```

MV3 output:
```json
{
  "manifest_version": 3,
  "action": { "default_title": "Some Title" },
  "web_accessible_resources": [{ "matches": ["*://*.google.com/*"], "resources": ["icon/*.png"] }]
}
```

### Manifest as a Function

Use a function to generate the manifest based on build context. **Required when using environment variables** (`.env` files are not loaded until after the config file is parsed):

```ts
export default defineConfig({
  manifest: ({ browser, manifestVersion, mode, command }) => {
    const isDev = mode === 'development';
    return {
      oauth2: {
        client_id: import.meta.env.WXT_APP_CLIENT_ID,
      },
      host_permissions: manifestVersion === 2 ? [...] : [...],
    };
  },
});
```

Note: Vite runtime env vars like `import.meta.env.DEV` are not defined in the manifest function — use `mode` instead.

### Version and Name

- `name` defaults to `package.json` `name`
- `version` and `version_name` come from `package.json` `version`
  - `version_name` = exact string (e.g. `"1.3.0-alpha2"`)
  - `version` = cleaned string with invalid suffixes removed (e.g. `"1.3.0"`)
  - Defaults to `"0.0.0"` if not in `package.json`

### Icons

WXT auto-discovers icons in `public/` matching patterns like `icon-16.png`, `icon-128.png`. Override manually:

```ts
export default defineConfig({
  manifest: {
    icons: {
      16: '/extension-icon-16.png',
      48: '/extension-icon-48.png',
      128: '/extension-icon-128.png',
    },
  },
});
```

Use `@wxt-dev/auto-icons` module to generate icons at required sizes automatically.

### Permissions

Most permissions must be added manually. WXT auto-adds:
- `tabs` and `scripting` during development (for hot reloading)
- `sidepanel` when a sidepanel entrypoint is present

```ts
export default defineConfig({
  manifest: {
    permissions: ['storage', 'tabs'],
    host_permissions: ['https://www.google.com/*'],
  },
});
```

### Actions

By default, WXT falls back to `browser_action` when targeting MV2. To use `page_action`, add a meta tag to the popup HTML:

```html
<meta name="manifest.type" content="page_action" />
```

For an action without a popup (e.g. to use `browser.action.onClicked`):

```ts
export default defineConfig({
  manifest: {
    action: {},
  },
});
```

## Environment Variables

### Dotenv Files

WXT follows Vite's dotenv convention. Files are loaded in order (later files take precedence):

```plaintext
.env
.env.local
.env.[mode]
.env.[mode].local
.env.[browser]
.env.[browser].local
.env.[mode].[browser]
.env.[mode].[browser].local
```

Variables must be prefixed with `WXT_` or `VITE_` to be exposed at runtime:

```sh
# .env
WXT_API_KEY=abc123
```

```ts
await fetch(`/api?key=${import.meta.env.WXT_API_KEY}`);
```

### Built-in Environment Variables

| Variable | Type | Description |
|---|---|---|
| `import.meta.env.MANIFEST_VERSION` | `2 \| 3` | Target manifest version |
| `import.meta.env.BROWSER` | `string` | Target browser (e.g. `"chrome"`) |
| `import.meta.env.CHROME` | `boolean` | Shorthand for `BROWSER === "chrome"` |
| `import.meta.env.FIREFOX` | `boolean` | Shorthand for `BROWSER === "firefox"` |
| `import.meta.env.SAFARI` | `boolean` | Shorthand for `BROWSER === "safari"` |
| `import.meta.env.EDGE` | `boolean` | Shorthand for `BROWSER === "edge"` |
| `import.meta.env.OPERA` | `boolean` | Shorthand for `BROWSER === "opera"` |
| `import.meta.env.MODE` | `string` | Build mode (`"development"` or `"production"`) |
| `import.meta.env.PROD` | `boolean` | When `NODE_ENV='production'` |
| `import.meta.env.DEV` | `boolean` | Opposite of `PROD` |

`import.meta.env.BASE_URL` is not useful in WXT — use `browser.runtime.getURL` instead.

## TypeScript Setup

### tsconfig.json

Run `wxt prepare` to generate `.wxt/tsconfig.json`. Then extend it:

```jsonc
// tsconfig.json
{
  "extends": ".wxt/tsconfig.json",
  "compilerOptions": {
    "jsx": "preserve"
  }
}
```

In monorepos where extending is not desired, add a reference:

```ts
/// <reference path="./.wxt/wxt.d.ts" />
```

### Path Aliases

Built-in aliases (do not add these to `tsconfig.json` manually):

| Alias | Resolves to | Example |
|---|---|---|
| `~` | `<srcDir>/*` | `import { fn } from "~/utils/strings"` |
| `@` | `<srcDir>/*` | `import { fn } from "@/utils/strings"` |
| `~~` | `<rootDir>/*` | `import "~~/scripts"` |
| `@@` | `<rootDir>/*` | `import "@@/scripts"` |

Add custom aliases via `wxt.config.ts` only — this ensures they're added to both the bundler and `.wxt/tsconfig.json`:

```ts
import { resolve } from 'node:path';

export default defineConfig({
  alias: {
    testing: resolve('utils/testing'),   // directory
    strings: resolve('utils/strings.ts'), // file
  },
});
```

### postinstall Script

Add to `package.json` so editors have types after installing dependencies:

```jsonc
{
  "scripts": {
    "postinstall": "wxt prepare"
  }
}
```

## Runtime Config (app.config.ts)

Define typed runtime config in `<srcDir>/app.config.ts`. This file is committed to the repo — do not put secrets here.

```ts
// app.config.ts
import { defineAppConfig } from '#imports';

declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig {
    theme?: 'light' | 'dark';
    apiKey?: string;
    skipWelcome: boolean;
  }
}

export default defineAppConfig({
  theme: 'dark',
  apiKey: import.meta.env.WXT_API_KEY,
  skipWelcome: import.meta.env.WXT_SKIP_WELCOME === 'true',
});
```

Access at runtime with `getAppConfig()`:

```ts
import { getAppConfig } from '#imports';

const { theme, skipWelcome } = getAppConfig();
```

Benefits of using `app.config.ts` for env vars: single place to define all expected variables, type conversion (strings to booleans/arrays), and default values.

## Auto-imports Config

WXT uses `unimport` to auto-import from:
- All WXT APIs
- `<srcDir>/components/*`
- `<srcDir>/composables/*`
- `<srcDir>/hooks/*`
- `<srcDir>/utils/*`

Import WXT APIs explicitly via `#imports` (works with or without auto-imports enabled):

```ts
import { createShadowRootUi, ContentScriptContext, MatchPattern } from '#imports';
```

Disable auto-imports entirely:

```ts
export default defineConfig({
  imports: false,
});
```

ESLint integration (generates `.wxt/eslint-auto-imports.mjs`):

```ts
// wxt.config.ts
export default defineConfig({
  imports: {
    eslintrc: { enabled: 9 }, // or 8 for ESLint 8
  },
});
```

```js
// eslint.config.mjs (ESLint 9)
import autoImports from './.wxt/eslint-auto-imports.mjs';
export default [autoImports, { /* rest of config */ }];
```

To see all auto-imported APIs, run `wxt prepare` and check `.wxt/types/imports-module.d.ts`.

## Build Modes

```sh
wxt                          # dev, mode=development
wxt build                    # build, mode=production
wxt build --mode development # override mode
wxt zip --mode testing       # custom mode
```

Access mode at runtime:

```ts
switch (import.meta.env.MODE) {
  case 'development': break;
  case 'production': break;
  case 'testing': break;   // custom modes via --mode
}
```

## Vite Config

```ts
export default defineConfig({
  vite: (configEnv) => ({
    plugins:
      configEnv.mode === 'production'
        ? [removeConsole({ includes: ['log'] })]
        : [],
  }),
});
```

Some Vite plugins may not work as expected because WXT uses a combination of dev server and builds — check mode manually instead of relying on plugin defaults.

## Browser Startup (web-ext.config.ts)

Configure the browser opened during `wxt dev`. Three config locations (priority order):

1. `<rootDir>/web-ext.config.ts` — gitignored, per-developer settings
2. `<rootDir>/wxt.config.ts` via `webExt` key — committed, shared
3. `$HOME/web-ext.config.ts` — global defaults for all WXT projects

```ts
// web-ext.config.ts
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  // Custom browser binaries
  binaries: {
    chrome: '/path/to/chrome-beta',
    firefox: 'firefoxdeveloperedition',
    edge: '/path/to/edge',
  },

  // Persist Chrome profile (Mac/Linux)
  chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],

  // Disable auto-opening browser
  disabled: true,

  // Enable Chrome features disabled by default in web-ext
  chromiumArgs: ['--disable-features=DisableLoadExtensionCommandLineSwitch'],
});
```

On Windows, use `chromiumProfile` + `keepProfileChanges` instead of `--user-data-dir`.

## CLI Reference

| Command | Description |
|---|---|
| `wxt` | Start dev server (default browser: chrome) |
| `wxt -b firefox` | Start dev server targeting Firefox |
| `wxt build` | Build extension for production |
| `wxt build -b firefox` | Build for Firefox |
| `wxt build --mv2` | Build targeting Manifest V2 |
| `wxt build --mv3` | Build targeting Manifest V3 |
| `wxt zip` | Build and zip for store submission |
| `wxt zip -b firefox` | Zip for Firefox |
| `wxt prepare` | Generate `.wxt/` types and tsconfig |
| `wxt prepare --debug` | Debug entrypoint loading and hook execution order |
| `wxt clean` | Remove `.output/` and `.wxt/` |
| `wxt --mode staging` | Use custom build mode |
