# webext-core - Proxy Service

Package: `@webext-core/proxy-service`

Wraps the extension messaging APIs so that a service defined once in the background can be called transparently from any context (popup, content script, options page). All calls go through `browser.runtime.sendMessage` under the hood.

## Core API

```ts
import {
  createProxyService,
  registerService,
  isProxyService,
} from '@webext-core/proxy-service';
import type { ProxyService, ProxyServiceKey } from '@webext-core/proxy-service';
```

### `registerService(key, realService, config?)`

Call this **only in the background script**. Sets up message listeners that handle incoming proxy calls and delegate them to the real implementation.

Returns a `RemoveListenerCallback` (call it to tear down the listener).

### `createProxyService<T>(key, config?)`

Call this in any context (popup, content script, etc.) to get a proxy object. Every method on the proxy sends a message to the background and returns a `Promise`.

### `ProxyServiceKey<T>`

A branded string type that ties the key to the service type `T`, preventing type mismatches between `registerService` and `createProxyService`.

## Basic Usage

```ts
// services/math.ts — shared type
export interface MathService {
  add(a: number, b: number): number;
  multiply(a: number, b: number): Promise<number>;
}

// services/keys.ts — shared key
import type { ProxyServiceKey } from '@webext-core/proxy-service';
import type { MathService } from './math';
export const MATH_KEY = 'math-service' as ProxyServiceKey<MathService>;

// background.ts — register the real implementation
import { registerService } from '@webext-core/proxy-service';
import { MATH_KEY } from './services/keys';

const impl: MathService = {
  add: (a, b) => a + b,
  multiply: async (a, b) => a * b,
};
registerService(MATH_KEY, impl);

// popup.ts or content-script.ts — call from anywhere
import { createProxyService } from '@webext-core/proxy-service';
import { MATH_KEY } from './services/keys';

const math = createProxyService(MATH_KEY);

// All methods return Promise regardless of the original signature
const sum = await math.add(2, 3);          // Promise<number>
const product = await math.multiply(4, 5); // Promise<number>
```

## Auto-Promisification

Every method on the proxy always returns a `Promise`, even if the original method is synchronous. The `ProxyService<T>` utility type reflects this:

```ts
import type { ProxyService } from '@webext-core/proxy-service';

type Service = {
  sync(): number;           // becomes () => Promise<number>
  async(): Promise<string>; // stays    () => Promise<string>
};

type Proxied = ProxyService<Service>;
// { sync(): Promise<number>; async(): Promise<string> }
```

Non-function properties become `never` on the proxy type.

## Nested Method Objects

The proxy supports arbitrarily deep method nesting. Every property access returns another proxy; calling at any depth sends a message with the accumulated path:

```ts
interface Api {
  one(): number;
  two: {
    three(): Promise<number>;
    four: {
      five(): number;
    };
  };
}

registerService('api', apiImpl);
const proxy = createProxyService<Api>('api');

await proxy.one();           // ✓
await proxy.two.three();     // ✓
await proxy.two.four.five(); // ✓
```

## Class Instances

Classes work as the real service — `this` is correctly bound:

```ts
class CounterService {
  private count = 0;
  increment() { return ++this.count; }
  getCount()  { return this.count; }
}

registerService('counter', new CounterService());
```

## Plain Functions

A plain function (not an object) can also be registered:

```ts
type Greeter = (name: string) => Promise<string>;
const greeter: Greeter = async name => `Hello, ${name}!`;

registerService('greeter', greeter);

const proxy = createProxyService<Greeter>('greeter');
await proxy('World'); // "Hello, World!"
```

## Error Propagation

Errors thrown inside the real service are serialized (via `serialize-error`) and re-thrown on the caller side as proper `Error` instances.

```ts
// background service
registerService('svc', {
  risky() { throw new Error('Something went wrong'); },
});

// caller
try {
  await createProxyService<...>('svc').risky();
} catch (err) {
  console.error(err.message); // "Something went wrong"
}
```

## `isProxyService(obj)`

Returns `true` if `obj` was created by `createProxyService`:

```ts
import { isProxyService } from '@webext-core/proxy-service';

isProxyService(proxy);             // true
isProxyService({});                // false
isProxyService(new Proxy({}, {})); // false
```

## Messaging Config

Both `registerService` and `createProxyService` accept an optional `ExtensionMessagingConfig` (same interface as `@webext-core/messaging`) as the last argument, allowing a custom `logger` or `breakError` flag.

## Anti-Patterns

- Do not call `registerService` outside the background script — the listener will not serve other contexts.
- Do not expect synchronous return values from a proxy — every call returns a `Promise`.
- Do not use different key strings for the same service — share a typed `ProxyServiceKey<T>` constant.
