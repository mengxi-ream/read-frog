# webext-core - Storage

Package: `@webext-core/storage`

A type-safe, `localStorage`-like wrapper around the `browser.storage` APIs. Supports Chrome, Firefox, and Safari.

> **If using WXT**, prefer WXT's built-in `storage.defineItem()`, which adds versioning, migrations, and deeper framework integration. Use `@webext-core/storage` for non-WXT extensions or when you need a simple `localStorage`-style API.

## Pre-configured Instances

Four instances are exported, one per storage area:

```ts
import {
  localExtStorage,    // browser.storage.local   — up to 5 MB
  sessionExtStorage,  // browser.storage.session  — up to 10 MB, cleared on browser restart
  syncExtStorage,     // browser.storage.sync     — up to 100 KB, synced across devices
  managedExtStorage,  // browser.storage.managed  — read-only, set by IT policy
} from '@webext-core/storage';
```

`sessionExtStorage` requires browser support: Chrome 102+, Safari 16.4+, Firefox 115+.

## Basic Operations

```ts
import { localExtStorage } from '@webext-core/storage';

// Set a value (null/undefined stores null)
await localExtStorage.setItem('username', 'alice');

// Get a value — returns the value or null if missing
const name = await localExtStorage.getItem('username'); // 'alice' | null

// Remove a key
await localExtStorage.removeItem('username');

// Clear all keys in this storage area
await localExtStorage.clear();
```

## Custom Storage Instance with Schema Type

Use `defineExtensionStorage<Schema>` to get full type safety:

```ts
import { defineExtensionStorage } from '@webext-core/storage';
import browser from 'webextension-polyfill';

interface AppSchema {
  installDate: number;
  theme: 'light' | 'dark';
  lastSyncedAt: string | null;
}

const appStorage = defineExtensionStorage<AppSchema>(browser.storage.local);

await appStorage.setItem('theme', 'dark');           // Only 'light' | 'dark' accepted
const theme = await appStorage.getItem('theme');     // Typed as 'light' | 'dark' | null
await appStorage.removeItem('installDate');           // Only valid keys accepted
```

Pass any `Storage.StorageArea` — `browser.storage.local`, `browser.storage.sync`, `browser.storage.session`, or `browser.storage.managed`.

## `onChange` — Change Listeners

Listen for changes to a specific key. Returns a `RemoveListenerCallback`:

```ts
import { localExtStorage } from '@webext-core/storage';

const unsubscribe = localExtStorage.onChange('theme', (newValue, oldValue) => {
  console.log(`Theme changed from ${oldValue} to ${newValue}`);
  applyTheme(newValue);
});

// Stop listening
unsubscribe();
```

The callback signature is `(newValue: T, oldValue: T | null) => void`. Listeners are invoked in parallel in the order they were added.

The underlying listener (`browser.storage.onChanged`) is only registered while at least one `onChange` subscriber exists, and is removed automatically when all subscribers unsubscribe.

## `ExtensionStorage` Interface

All storage instances implement this interface:

```ts
interface ExtensionStorage<TSchema extends Record<string, any>> {
  clear(): Promise<void>;
  getItem<K extends keyof TSchema>(key: K): Promise<TSchema[K] | null>;
  setItem<K extends keyof TSchema>(key: K, value: TSchema[K]): Promise<void>;
  removeItem<K extends keyof TSchema>(key: K): Promise<void>;
  onChange<K extends keyof TSchema>(
    key: K,
    cb: (newValue: TSchema[K], oldValue: TSchema[K] | null) => void,
  ): () => void;
}
```

## Comparison to `localStorage`

| Feature | `localStorage` | `@webext-core/storage` |
|---|---|---|
| API style | Synchronous | Async (Promise-based) |
| Value types | Strings only | Any JSON-serializable value |
| Cross-context | No | Yes (via browser.storage) |
| Type safety | No | Yes (via schema generic) |
| Change events | `storage` event | `onChange` callback |
