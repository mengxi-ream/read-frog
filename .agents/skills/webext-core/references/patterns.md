# webext-core - Cross-Package Patterns

Patterns combining multiple `@webext-core` packages together.

## Service + Job Scheduler

Register both in the background script. The scheduler's execute function calls the proxy service directly (since both are in the same background context, the call is handled locally without a round-trip):

```ts
// services/sync.ts
import { registerService, createProxyService } from '@webext-core/proxy-service';
import type { ProxyServiceKey } from '@webext-core/proxy-service';

interface SyncService {
  syncNow(): Promise<void>;
  getLastSyncTime(): number | null;
}

export const SYNC_KEY = 'sync-service' as ProxyServiceKey<SyncService>;
export const syncService = createProxyService(SYNC_KEY);

// background.ts
import { defineJobScheduler } from '@webext-core/job-scheduler';
import { registerService } from '@webext-core/proxy-service';
import { SYNC_KEY, syncService } from './services/sync';

let lastSyncTime: number | null = null;

registerService(SYNC_KEY, {
  async syncNow() {
    await fetchAndStore();
    lastSyncTime = Date.now();
  },
  getLastSyncTime() {
    return lastSyncTime;
  },
});

const scheduler = defineJobScheduler();
scheduler.on('error', (job, err) => console.error(`Job "${job.id}" failed:`, err));

await scheduler.scheduleJob({
  id: 'auto-sync',
  type: 'interval',
  duration: 30 * 60 * 1000, // 30 minutes
  immediate: true,
  execute: () => syncService.syncNow(),
});
```

## Messaging + Match Patterns

Validate that messages come from allowed pages using a match pattern on `sender.tab?.url`:

```ts
import { MatchPattern } from '@webext-core/match-patterns';
import { onMessage } from './messaging';

const allowed = new MatchPattern('*://*.mysite.com/*');

onMessage('performAction', ({ sender }) => {
  const url = sender.tab?.url;
  if (!url || !allowed.includes(url)) {
    throw new Error(`Not allowed from: ${url}`);
  }
  return doTheWork();
});
```

## Service + Isolated Element

Content script UI that calls a background service:

```ts
// content-script.ts
import { createIsolatedElement } from '@webext-core/isolated-element';
import { createProxyService } from '@webext-core/proxy-service';
import { COUNTER_KEY } from './services/counter';
import browser from 'webextension-polyfill';

const counter = createProxyService(COUNTER_KEY);

const { parentElement, isolatedElement } = await createIsolatedElement({
  name: 'my-ext-widget',
  css: { url: browser.runtime.getURL('/assets/widget.css') },
  isolateEvents: true,
});

const btn = document.createElement('button');
btn.textContent = 'Count: 0';
btn.addEventListener('click', async () => {
  const count = await counter.increment(); // proxied to background
  btn.textContent = `Count: ${count}`;
});

isolatedElement.appendChild(btn);
document.body.appendChild(parentElement);
```

## Anti-Patterns

### Multiple Listeners for the Same Message Type

In any single JS context only one listener per message type is allowed. Registering a second listener throws an error (it does not silently replace the first):

```ts
// WRONG — throws "[messaging] In this JS context, only one listener can be setup for getData"
onMessage('getData', () => fetchFromCache());
onMessage('getData', () => fetchFromNetwork());

// CORRECT — one listener, conditional logic inside
onMessage('getData', ({ data }) => {
  return data.preferCache ? fetchFromCache() : fetchFromNetwork();
});
```

**Why:** The single-listener rule is enforced by the messaging library to prevent accidental shadowing. You must consolidate all handling for a type into one callback.

### Job Intervals Under 1 Minute

The browser Alarms API silently rounds intervals up to 1 minute. A `duration` of 10,000 ms behaves identically to 60,000 ms:

```ts
// WRONG — fires every 60 seconds despite the intent
await scheduler.scheduleJob({
  id: 'fast-poll',
  type: 'interval',
  duration: 10_000, // effectively 60_000 at runtime
  execute: () => poll(),
});

// CORRECT — use 1-minute minimum for alarm-backed jobs
await scheduler.scheduleJob({
  id: 'poll',
  type: 'interval',
  duration: 60_000,
  execute: () => poll(),
});
```

**Why:** The Alarms API is the only mechanism for work that survives service-worker termination. Its minimum granularity is 1 minute per browser policy.

### Forgetting `fakeBrowser.reset()` Between Tests

Without resetting, in-memory state (storage, alarms, tabs, listeners) from one test bleeds into the next:

```ts
// WRONG — second test depends on first test's storage state
describe('storage', () => {
  it('sets a value', async () => {
    await browser.storage.local.set({ count: 1 });
  });
  it('reads zero', async () => {
    const result = await browser.storage.local.get('count');
    // Fails! count is still 1 from the previous test
    expect(result.count).toBeUndefined();
  });
});

// CORRECT
describe('storage', () => {
  beforeEach(() => { fakeBrowser.reset(); });

  it('sets a value', async () => {
    await browser.storage.local.set({ count: 1 });
  });
  it('reads nothing (isolated)', async () => {
    const result = await browser.storage.local.get('count');
    expect(result.count).toBeUndefined(); // passes
  });
});
```

**Why:** `fakeBrowser` holds all state in module-level variables. Without `reset()`, every test suite shares the same mutable state.

### Expecting Synchronous Returns from Proxy Services

Every method on a proxy service returns a `Promise`, even if the real implementation is synchronous:

```ts
// WRONG — name is a Promise<string>, not a string
const name = createProxyService(MY_KEY).getName();
console.log(name.toUpperCase()); // TypeError: name.toUpperCase is not a function

// CORRECT
const name = await createProxyService(MY_KEY).getName();
console.log(name.toUpperCase()); // works
```

**Why:** All proxy calls cross a context boundary via `browser.runtime.sendMessage`, which is inherently async.

### Calling `registerService()` Outside the Background Script

`registerService` must only be called in the background script. Calling it from a popup or content script creates a listener that can only respond to messages from that tab's context — not from other contexts:

```ts
// WRONG — registering in popup.ts
// popup.ts
registerService(COUNTER_KEY, new CounterService());
// The counter state is local to the popup, not shared

// CORRECT — only in background.ts
// background.ts
registerService(COUNTER_KEY, new CounterService());
```

**Why:** `browser.runtime.sendMessage` routes to the background. A listener registered elsewhere won't receive those messages.
