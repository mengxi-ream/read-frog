# WXT - Storage

WXT ships with a built-in storage wrapper around the extension storage APIs. Available via auto-import or `import { storage } from '#imports'`.

Add the `"storage"` permission to the manifest:

```ts
export default defineConfig({
  manifest: {
    permissions: ['storage'],
  },
});
```

## Storage Area Prefixes

All keys must be prefixed with the storage area:

```ts
await storage.getItem('local:key');    // chrome.storage.local
await storage.getItem('session:key');  // chrome.storage.session
await storage.getItem('sync:key');     // chrome.storage.sync
await storage.getItem('managed:key');  // chrome.storage.managed (read-only)

// Wrong — throws an error:
await storage.getItem('key');
```

## Basic Operations

```ts
// Get
const value = await storage.getItem<string>('local:username');
// Returns null if not set

// Set
await storage.setItem('local:username', 'alice');

// Remove
await storage.removeItem('local:username');
```

## defineItem

Use `storage.defineItem()` to define a typed storage item with configuration in one place:

```ts
// utils/storage.ts
const showChangelog = storage.defineItem<boolean>('local:showChangelog', {
  fallback: true,
});

const userId = storage.defineItem<string>('local:userId', {
  init: () => crypto.randomUUID(),
});
```

Storage item methods:

```ts
await showChangelog.getValue();    // returns value or fallback
await showChangelog.setValue(false);
await showChangelog.removeValue();
const unwatch = showChangelog.watch((newValue) => {
  console.log('changed:', newValue);
});
```

### fallback vs init

- **`fallback`** — Returns the fallback from `getValue()` if no value is stored. Does **not** write anything to storage.
  ```ts
  const theme = storage.defineItem('local:theme', { fallback: 'dark' });
  await theme.getValue(); // 'dark' even though nothing is stored
  ```

- **`init`** — Immediately writes a value to storage if nothing is stored there yet. Use for values that need to be generated once (UUIDs, timestamps).
  ```ts
  const installDate = storage.defineItem('local:installDate', {
    init: () => Date.now(),
  });
  // Value is written to storage immediately when defineItem is called
  ```

## Versioning and Migrations

When a storage item's schema needs to change, use versioning. Start from version 1 when first adding versioning.

```ts
// v1: strings only
type IgnoredWebsiteV1 = string;

export const ignoredWebsites = storage.defineItem<IgnoredWebsiteV1[]>(
  'local:ignoredWebsites',
  {
    fallback: [],
    version: 1,
  },
);
```

```ts
// v2: strings become objects
import { nanoid } from 'nanoid';

type IgnoredWebsiteV1 = string;
interface IgnoredWebsiteV2 {
  id: string;
  website: string;
}

export const ignoredWebsites = storage.defineItem<IgnoredWebsiteV2[]>(
  'local:ignoredWebsites',
  {
    fallback: [],
    version: 2,
    migrations: {
      2: (websites: IgnoredWebsiteV1[]): IgnoredWebsiteV2[] => {
        return websites.map((website) => ({ id: nanoid(), website }));
      },
    },
  },
);
```

```ts
// v3: add enabled field
interface IgnoredWebsiteV2 { id: string; website: string; }
interface IgnoredWebsiteV3 { id: string; website: string; enabled: boolean; }

export const ignoredWebsites = storage.defineItem<IgnoredWebsiteV3[]>(
  'local:ignoredWebsites',
  {
    fallback: [],
    version: 3,
    migrations: {
      2: (websites: IgnoredWebsiteV1[]): IgnoredWebsiteV2[] =>
        websites.map((website) => ({ id: nanoid(), website })),
      3: (websites: IgnoredWebsiteV2[]): IgnoredWebsiteV3[] =>
        websites.map((website) => ({ ...website, enabled: true })),
    },
  },
);
```

**Adding versioning to an existing unversioned item:** WXT assumes unversioned items are version 1. Set `version: 2` and add a `2:` migration — it will just work.

Migrations run as soon as `storage.defineItem` is called. Calls to `getValue`, `setValue`, etc. automatically wait for migrations to complete before executing.

Internally, the current version is tracked in metadata at key `{key}$` with property `v`.

## Watchers

```ts
// On storage object
const unwatch = storage.watch<number>('local:counter', (newCount, oldCount) => {
  console.log('Count changed:', { newCount, oldCount });
});

// On a defined item
const unwatch = showChangelog.watch((newValue) => {
  console.log('changed:', newValue);
});

// Remove the listener
unwatch();
```

## Metadata

Metadata is stored at `{key}$` and used for versioning and custom properties:

```ts
// Set metadata (merges with existing)
await storage.setMeta('local:preference', { lastModified: Date.now() });
await storage.setMeta('local:preference', { v: 2 });

// Get metadata
const meta = await storage.getMeta('local:preference');
// { v: 2, lastModified: 1703690746007 }

// Remove metadata
await storage.removeMeta('local:preference');               // remove all
await storage.removeMeta('local:preference', 'lastModified'); // remove one property
await storage.removeMeta('local:preference', ['lastModified', 'v']); // remove multiple
```

## Bulk Operations

Reduce storage calls by operating on multiple keys at once:

```ts
const userId = storage.defineItem('local:userId');

// Get multiple values
const [installDate, user] = await storage.getItems([
  'local:installDate',
  { item: userId },
]);

// Set multiple values
await storage.setItems([
  { key: 'local:installDate', value: Date.now() },
  { item: userId, value: generateUserId() },
]);

// Get/set/remove metadata for multiple keys
await storage.getMetas(['local:key1', 'local:key2']);
await storage.setMetas([{ key: 'local:key', meta: { v: 2 } }]);
await storage.removeItems(['local:key1', 'local:key2']);
```

All bulk methods support both plain string keys and defined storage items.
