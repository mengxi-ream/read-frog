# WXT - Patterns and Anti-Patterns

## Common Patterns

### Service Registration (Proxy Service)

Define logic once in the background, call it from anywhere. Uses `@webext-core/proxy-service`:

```ts
// utils/api-service.ts
import { defineProxyService } from '@webext-core/proxy-service';

function createApiService() {
  return {
    async fetchUser(id: string) {
      const res = await fetch(`https://api.example.com/users/${id}`);
      return res.json();
    },
    async saveData(data: unknown) {
      await storage.setItem('local:data', data);
    },
  };
}

export const [registerApiService, getApiService] = defineProxyService(
  'ApiService',
  createApiService,
);
```

```ts
// entrypoints/background.ts
import { registerApiService } from '../utils/api-service';

export default defineBackground(() => {
  registerApiService(); // register once in background
});
```

```ts
// entrypoints/popup/main.ts or any content script
import { getApiService } from '../utils/api-service';

const service = getApiService();
const user = await service.fetchUser('123'); // proxied to background
```

### Storage Event Broadcasting (Cross-context Communication)

Use storage watchers to broadcast state changes across all contexts without messaging:

```ts
// Any context — update state
await storage.setItem('local:theme', 'dark');

// Any other context — react to the change
storage.watch<string>('local:theme', (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme ?? 'light');
});
```

With `defineItem`:

```ts
const theme = storage.defineItem<'light' | 'dark'>('local:theme', {
  fallback: 'light',
});

theme.watch((newTheme) => {
  applyTheme(newTheme);
});
```

### Content Script Context Invalidation Handling

Always use `ctx` helpers to prevent "Extension context invalidated" errors after updates:

```ts
export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    // Use ctx.addEventListener instead of window.addEventListener
    ctx.addEventListener(window, 'message', handler);

    // Use ctx.setInterval instead of setInterval
    const intervalId = ctx.setInterval(() => {
      if (!ctx.isValid) return;
      checkForUpdates();
    }, 5000);

    // Use ctx.onInvalidated for cleanup
    ctx.onInvalidated(() => {
      cleanup();
    });
  },
});
```

### Browser Startup Config (web-ext.config.ts)

Keep per-developer browser settings out of version control:

```ts
// web-ext.config.ts (gitignored)
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  // Persist profile so logins/settings survive dev restarts
  chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],

  // Use specific browser binary
  binaries: {
    chrome: '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
  },
});
```

Add `web-ext.config.ts` to `.gitignore` and document the options in the README.

### SPA Navigation Pattern

For sites using HTML5 history navigation, listen for `wxt:locationchange`:

```ts
const targetPattern = new MatchPattern('*://*.example.com/app/*');

export default defineContentScript({
  // Match broadly so the script stays alive across navigations
  matches: ['*://*.example.com/*'],

  main(ctx) {
    // Handle initial page load
    if (targetPattern.includes(new URL(window.location.href))) {
      mountUi(ctx);
    }

    // Handle subsequent navigations
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      if (targetPattern.includes(newUrl)) {
        mountUi(ctx);
      }
    });
  },
});
```

## Anti-Patterns

### Runtime Code Outside main()

**Wrong:**
```ts
// entrypoints/background.ts
browser.action.onClicked.addListener(() => { ... }); // runs in NodeJS during build!

export default defineBackground(() => {
  // ...
});
```

**Why:** WXT imports entrypoint files in a NodeJS environment during the build to extract manifest options. Code outside `main()` runs in NodeJS, where `browser` and other globals don't exist.

**Correct:** All runtime code must be inside `main()`.

### Async defineBackground main()

**Wrong:**
```ts
export default defineBackground({
  async main() {       // ← async is not allowed
    await doSetup();
    browser.action.onClicked.addListener(handler);
  },
});
```

**Why:** The background's `main()` function cannot be `async`. The background service worker must register event listeners synchronously before it goes idle.

**Correct:** Use `.then()` or register listeners synchronously, then do async work inside them.

### Deep Nesting in entrypoints/

**Wrong:**
```
entrypoints/
  youtube/
    content/
      index.ts    ← WXT does not discover this
```

**Why:** WXT only discovers entrypoints zero or one level deep inside `entrypoints/`.

**Correct:** Use dot-notation for logical grouping: `entrypoints/youtube.content/index.ts`

### Missing cssInjectionMode for Shadow Root UI

**Wrong:**
```ts
import './style.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  // cssInjectionMode NOT set
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, { ... });
    ui.mount();
  },
});
```

**Why:** Without `cssInjectionMode: 'ui'`, the imported CSS is injected via the manifest as a regular content script stylesheet — it leaks onto the page and is not scoped to the shadow root.

**Correct:** Always set `cssInjectionMode: 'ui'` when using `createShadowRootUi` and importing CSS.

### Using world: 'MAIN' Directly

**Wrong:**
```ts
export default defineContentScript({
  world: 'MAIN',
  main() {
    // Accesses page's JS context but...
    // - No extension APIs available
    // - Chromium MV3 only
    // - No Firefox support
  },
});
```

**Why:** `world: 'MAIN'` is only supported in Chromium MV3 and provides no access to extension APIs.

**Correct:** Use `injectScript()` from an isolated world content script. This supports MV2, MV3, all browsers, and allows bidirectional communication with the extension API context.

### Helper Files Directly in entrypoints/

**Wrong:**
```
entrypoints/
  popup.html
  popup-utils.ts    ← WXT tries to build this as a separate entrypoint
  popup-types.ts    ← WXT tries to build this as a separate entrypoint
```

**Why:** Every file directly in `entrypoints/` is treated as an entrypoint.

**Correct:** Group in a directory, or put shared utilities in `utils/` (auto-imported).

### Custom Aliases in tsconfig.json

**Wrong:**
```jsonc
// tsconfig.json
{
  "extends": ".wxt/tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@testing/*": ["./utils/testing/*"]
    }
  }
}
```

**Why:** Adding aliases to `tsconfig.json` only tells TypeScript about them — the bundler (Vite) does not know about them, causing runtime import errors.

**Correct:** Add aliases via `wxt.config.ts` `alias` option — WXT adds them to both the bundler and `.wxt/tsconfig.json`.

## CLI Reference

| Command | Description |
|---|---|
| `wxt` | Start dev server (targets chrome by default) |
| `wxt -b firefox` | Start dev server targeting Firefox |
| `wxt build` | Build for production (chrome) |
| `wxt build -b firefox` | Build for Firefox |
| `wxt build --mv2` | Build targeting Manifest V2 |
| `wxt build --mv3` | Build targeting Manifest V3 |
| `wxt zip` | Build and zip for store submission |
| `wxt zip -b firefox` | Zip for Firefox AMO submission |
| `wxt prepare` | Generate `.wxt/` types, tsconfig, and auto-import configs |
| `wxt prepare --debug` | Debug mode: shows processed entrypoint code and hook order |
| `wxt clean` | Remove `.output/` and `.wxt/` directories |
| `wxt --mode staging` | Use a custom build mode |
| `wxt build --mode testing` | Build in a custom mode |
