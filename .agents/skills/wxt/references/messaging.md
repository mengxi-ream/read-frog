# WXT - Messaging

WXT does not provide a built-in messaging abstraction. The vanilla browser messaging APIs (`browser.runtime.sendMessage`, `browser.runtime.onMessage`) work but are difficult to use correctly.

WXT recommends using an NPM package that wraps the vanilla APIs.

## Recommended Packages

| Package | Description |
|---|---|
| [`@webext-core/proxy-service`](https://www.npmjs.com/package/@webext-core/proxy-service) | Call functions from any context, execute them in the background. Type-safe, RPC-style. |
| [`@webext-core/messaging`](https://www.npmjs.com/package/@webext-core/messaging) | Lightweight, type-safe wrapper around the web extension messaging APIs. |
| [`trpc-chrome`](https://www.npmjs.com/package/trpc-chrome) | tRPC adapter for Web Extensions. Full tRPC support across extension contexts. |
| [`webext-bridge`](https://www.npmjs.com/package/webext-bridge) | Simple messaging across all extension contexts (background, content, popup, devtools). |
| [`Comctx`](https://github.com/molvqingtai/comctx) | Cross-context RPC with type safety and flexible adapters. |

All of these support all browsers and work with WXT.

## Proxy Service Pattern (@webext-core/proxy-service)

The proxy service pattern is recommended for most use cases. Define a service in the background, then call it from content scripts, popup, or anywhere else — the call is transparently proxied to the background via messaging.

```ts
// utils/my-service.ts
import { defineProxyService } from '@webext-core/proxy-service';

function createMyService() {
  return {
    async doSomething(param: string): Promise<string> {
      // This runs in the background
      const result = await fetch(`https://api.example.com/${param}`);
      return result.json();
    },
  };
}

export const [registerMyService, getMyService] = defineProxyService(
  'MyService',
  createMyService,
);
```

```ts
// entrypoints/background.ts
import { registerMyService } from '../utils/my-service';

export default defineBackground(() => {
  // Register once in the background
  registerMyService();
});
```

```ts
// Any other context (content script, popup, options page, etc.)
import { getMyService } from '../utils/my-service';

const service = getMyService();
const result = await service.doSomething('hello');
// The call is proxied to the background and the result is returned
```

This pattern centralizes logic in the background while providing a clean, type-safe API callable from any extension context.
