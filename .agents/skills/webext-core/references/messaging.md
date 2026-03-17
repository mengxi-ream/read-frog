# webext-core - Messaging

Package: `@webext-core/messaging`

A lightweight, type-safe wrapper around the `browser.runtime` messaging APIs. Supports Chrome, Firefox, and Safari.

## Extension Messaging — Background ↔ Popup / Content Scripts

Backed by `browser.runtime.sendMessage` and `browser.tabs.sendMessage`.

### Define the Protocol Map

Use the **function syntax** (recommended). Each entry maps a message type name to a function signature where the parameter is the data and the return type is what the listener returns:

```ts
// messaging.ts
import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  getUser(userId: string): { name: string; email: string };
  saveSettings(settings: { theme: string }): void;
  ping(): 'pong';
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
```

### `sendMessage(type, data, tabIdOrOptions?)`

```ts
import { sendMessage } from './messaging';

// Popup or content script → background (no third argument)
const user = await sendMessage('getUser', 'user-123');

// Background → specific tab (pass tabId as number)
await sendMessage('ping', undefined, 42);

// Background → specific tab + frame (pass options object)
await sendMessage('ping', undefined, { tabId: 42, frameId: 0 });
```

### `onMessage(type, callback)`

Returns a `RemoveListenerCallback`. Call it to unsubscribe.

```ts
import { onMessage } from './messaging';

// background.ts
onMessage('getUser', ({ data: userId }) => {
  return db.getUser(userId); // sync or async; return value is sent back
});

onMessage('saveSettings', ({ data: settings }) => {
  storage.set(settings); // void return is fine
});

onMessage('ping', () => 'pong');
```

### Message Object Shape

The callback receives a `Message` object:

```ts
onMessage('getUser', (message) => {
  message.id;        // number  — auto-incrementing trace ID
  message.type;      // 'getUser'
  message.data;      // typed payload (userId: string here)
  message.timestamp; // number  — ms since epoch when sent
  message.sender;    // Runtime.MessageSender — tab info, frameId, url, etc.
});
```

### Targeting a Specific Tab

To send from the background to a content script, pass the `tabId`:

```ts
// Send to tab 42
await sendMessage('ping', undefined, 42);

// Send to tab 42, frame 0
await sendMessage('ping', undefined, { tabId: 42, frameId: 0 });
```

You cannot message between two tabs directly; messages must route through the background.

## Window Messaging — Content Script ↔ Injected Script

Backed by `window.postMessage`. Used to communicate between the isolated content-script world and a script injected into the page's main world.

Requires a `namespace` string to prevent collisions with other extensions.

```ts
// shared/window-messaging.ts
import { defineWindowMessaging } from '@webext-core/messaging';

interface WindowProtocol {
  getPageData(): { title: string; url: string };
  notifyExtension(payload: { event: string }): void;
}

export const { sendMessage, onMessage } = defineWindowMessaging<WindowProtocol>({
  namespace: 'my-extension',
});
```

```ts
// injected-script.ts (main world) — full DOM access
import { onMessage } from './shared/window-messaging';

onMessage('getPageData', () => ({
  title: document.title,
  url: location.href,
}));
```

```ts
// content-script.ts (isolated world)
import { sendMessage } from './shared/window-messaging';

const data = await sendMessage('getPageData', undefined);
```

`sendMessage` for window messaging accepts an optional second argument `targetOrigin` (defaults to `'*'`):

```ts
await sendMessage('getPageData', undefined, 'https://example.com');
```

## Custom Event Messaging — Alternative to Window Messaging

`defineCustomEventMessaging` uses the `CustomEvent` API instead of `window.postMessage`. Useful when `postMessage` conflicts with third-party libraries on the page. Requires the same `namespace` option.

```ts
import { defineCustomEventMessaging } from '@webext-core/messaging';

interface Protocol {
  getData(): string;
}

export const { sendMessage, onMessage } = defineCustomEventMessaging<Protocol>({
  namespace: 'my-extension',
});
```

The message object in listeners includes an additional `event` field (the original `CustomEvent`).

## One-Listener-Per-Type Rule

Each message type may have **only one listener per JS context**. Attempting to add a second listener for the same type throws an error:

```ts
// WRONG — throws "[messaging] In this JS context, only one listener can be setup for getData"
onMessage('getData', () => 'first');
onMessage('getData', () => 'second');

// CORRECT — single listener with branching logic
onMessage('getData', ({ data }) => {
  return data.useCache ? fetchFromCache() : fetchFromNetwork();
});
```

## `removeAllListeners()`

Both `defineExtensionMessaging` and `defineWindowMessaging` return a `removeAllListeners()` method that removes every listener registered through that messenger instance:

```ts
const { sendMessage, onMessage, removeAllListeners } = defineExtensionMessaging<ProtocolMap>();

// ...later, in cleanup
removeAllListeners();
```

## Logging

Pass a custom `logger` (or `null` to disable) via the config:

```ts
const messenger = defineExtensionMessaging<ProtocolMap>({
  logger: null, // disables all [messaging] console output
});
```

## Deprecated: `ProtocolWithReturn`

The object-style `ProtocolWithReturn<TData, TReturn>` is deprecated. Use the function syntax instead:

```ts
// Deprecated
interface ProtocolMap {
  getUser: ProtocolWithReturn<string, User>;
}

// Preferred
interface ProtocolMap {
  getUser(userId: string): User;
}
```
