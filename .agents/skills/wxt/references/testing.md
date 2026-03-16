# WXT - Testing

## Vitest Setup

WXT provides first-class Vitest support via the `WxtVitest` plugin:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
});
```

## What WxtVitest Does

The plugin automatically:

- Polyfills `browser` (Chrome extension API) with an in-memory implementation using `@webext-core/fake-browser`
- Applies all Vite config and plugins from `wxt.config.ts`
- Configures auto-imports (if enabled in the project)
- Applies internal WXT Vite plugins (e.g. for bundling remote code)
- Sets up global variables: `import.meta.env.BROWSER`, `import.meta.env.MANIFEST_VERSION`, `import.meta.env.CHROME`, etc.
- Configures path aliases (`@/*`, `@@/*`, `~/`, etc.)

## fakeBrowser and Test Structure

Import `fakeBrowser` from `wxt/testing/fake-browser` and call `fakeBrowser.reset()` in `beforeEach` to reset all in-memory state between tests:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

const accountStorage = storage.defineItem<Account>('local:account');

async function isLoggedIn(): Promise<boolean> {
  const value = await accountStorage.getValue();
  return value != null;
}

describe('isLoggedIn', () => {
  beforeEach(() => {
    // Reset all fake browser state (storage, tabs, etc.) between tests
    fakeBrowser.reset();
  });

  it('should return true when account exists in storage', async () => {
    const account: Account = {
      username: 'alice',
      preferences: {},
    };
    await accountStorage.setValue(account);

    expect(await isLoggedIn()).toBe(true);
  });

  it('should return false when account does not exist in storage', async () => {
    await accountStorage.removeValue();

    expect(await isLoggedIn()).toBe(false);
  });
});
```

`@webext-core/fake-browser` implements storage in-memory — no mocking needed for storage tests.

## Mocking WXT APIs (Finding Real Import Paths)

Auto-imports via `#imports` are rewritten by the preprocessor. To mock a WXT utility, you need the real import path — not `#imports`:

```ts
// What you write:
import { injectScript, createShadowRootUi } from '#imports';

// What Vitest sees after preprocessing:
import { injectScript } from 'wxt/utils/inject-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
```

To mock `injectScript`:

```ts
vi.mock('wxt/utils/inject-script', () => ({
  injectScript: vi.fn().mockResolvedValue({ script: document.createElement('script') }),
}));
```

**Finding real paths:** Run `wxt prepare` and look at `.wxt/types/imports-module.d.ts`. Each auto-imported name maps to its real module path in that file.
