# webext-core - Fake Browser

Package: `@webext-core/fake-browser`

An in-memory implementation of `webextension-polyfill` for unit testing. Implements the `browser` APIs without requiring a real browser environment.

## Setup (Standalone / Non-WXT)

```ts
// vitest.setup.ts
import { fakeBrowser } from '@webext-core/fake-browser';

// Replace the global browser mock with the fake
vi.mock('webextension-polyfill');
globalThis.browser = fakeBrowser;
```

## Setup (WXT)

WXT's `WxtVitest()` plugin configures `fakeBrowser` automatically. Import it from:

```ts
import { fakeBrowser } from 'wxt/testing';
```

## Usage in Tests

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

vi.mock('webextension-polyfill');

describe('my service', () => {
  beforeEach(() => {
    fakeBrowser.reset(); // Always reset state between tests
  });

  it('stores and retrieves data', async () => {
    await browser.storage.local.set({ key: 'value' });
    const result = await browser.storage.local.get('key');
    expect(result).toEqual({ key: 'value' });
  });

  it('creates and reads alarms', async () => {
    await browser.alarms.create('test', { delayInMinutes: 1 });
    const alarm = await browser.alarms.get('test');
    expect(alarm?.name).toBe('test');
  });
});
```

## Implemented APIs

| API | Status | Notes |
|---|---|---|
| `browser.alarms` | Full | `create`, `get`, `getAll`, `clear`, `clearAll`, `onAlarm` |
| `browser.notifications` | Full | `onClosed`, `onClicked`, `onButtonClicked`, `onShown` |
| `browser.runtime` | Partial | `id`, `getURL`, `sendMessage`, `onMessage`, `onInstalled`, `onStartup`, `onSuspend`, `onSuspendCanceled`, `onUpdateAvailable` |
| `browser.storage` | Full | `local`, `session`, `sync`, `managed`; all four support `get`, `set`, `remove`, `clear`, `onChanged` |
| `browser.tabs` | Partial | `get`, `getCurrent`, `create`, `duplicate`, `query`, `highlight`, `update`, `remove`; `onCreated`, `onUpdated`, `onActivated`, `onHighlighted`, `onRemoved` |
| `browser.windows` | Partial | `get`, `getAll`, `create`, `getCurrent`, `getLastFocused`, `update`, `remove`; `onCreated`, `onRemoved`, `onFocusChanged` |
| `browser.webNavigation` | Events only | `onBeforeNavigate`, `onCommitted`, `onDOMContentLoaded`, `onCompleted`, `onErrorOccurred`, `onCreatedNavigationTarget`, `onReferenceFragmentUpdated`, `onTabReplaced`, `onHistoryStateUpdated` |

## `EventForTesting` — Triggering Events in Tests

Every implemented event has a `.trigger(...args)` method that manually fires the event and returns a `Promise` resolving to an array of all listener return values.

```ts
import { fakeBrowser } from '@webext-core/fake-browser';
import { vi, expect, it } from 'vitest';

it('handles tab creation', async () => {
  const handler = vi.fn();
  browser.tabs.onCreated.addListener(handler);

  // Manually fire the event
  await fakeBrowser.tabs.onCreated.trigger({
    id: 1,
    url: 'https://example.com',
    active: true,
    index: 0,
    pinned: false,
    highlighted: false,
    windowId: 1,
    incognito: false,
  });

  expect(handler).toHaveBeenCalledOnce();
});

it('handles alarm firing', async () => {
  const handler = vi.fn();
  browser.alarms.onAlarm.addListener(handler);

  await fakeBrowser.alarms.onAlarm.trigger({ name: 'my-alarm', scheduledTime: Date.now() });

  expect(handler).toHaveBeenCalledWith({ name: 'my-alarm', scheduledTime: expect.any(Number) });
});

it('handles runtime.onInstalled', async () => {
  const handler = vi.fn();
  browser.runtime.onInstalled.addListener(handler);

  await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' });

  expect(handler).toHaveBeenCalledWith({ reason: 'install' });
});
```

## `reset()` Between Tests

`fakeBrowser.reset()` clears all in-memory state:

- All stored data in `storage.local`, `storage.session`, `storage.sync`, `storage.managed`
- All registered alarms
- All tabs (resets to a default tab)
- All windows (resets to a default window)
- All event listeners on every implemented API
- Resets `runtime.id` to `'test-extension-id'`

```ts
beforeEach(() => {
  fakeBrowser.reset();
});
```

Omitting this causes state to bleed between tests, producing hard-to-diagnose failures.

## `runtime.id` and `runtime.getURL`

The fake runtime uses `'test-extension-id'` as the extension ID by default:

```ts
browser.runtime.id; // 'test-extension-id'
browser.runtime.getURL('/icons/icon.png');
// 'chrome-extension://test-extension-id/icons/icon.png'
```
