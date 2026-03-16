---
name: webext-core
description: Utilities for browser extensions - proxy services for cross-context RPC, type-safe messaging, URL match patterns, fake browser for testing, job scheduling, and shadow DOM isolation.
---

# webext-core - Browser Extension Utilities

## When to Use

Apply this skill when:
- `package.json` has any `@webext-core/*` dependency
- Code imports `defineProxyService`, `flattenPromise` from `@webext-core/proxy-service`
- Code imports `defineExtensionMessaging`, `defineWindowMessaging` from `@webext-core/messaging`
- Code uses `MatchPattern` from `@webext-core/match-patterns`
- Tests use `fakeBrowser` from `@webext-core/fake-browser`
- Code uses `defineJobScheduler` from `@webext-core/job-scheduler`
- Code uses `createIsolatedElement` from `@webext-core/isolated-element`

## Quick Reference

| Package | Purpose | Reference |
|---------|---------|-----------|
| `@webext-core/proxy-service` | Cross-context RPC — call background services from anywhere | [references/proxy-service.md](references/proxy-service.md) |
| `@webext-core/messaging` | Type-safe extension/window/custom event messaging | [references/messaging.md](references/messaging.md) |
| `@webext-core/match-patterns` | URL pattern matching utilities | [references/match-patterns.md](references/match-patterns.md) |
| `@webext-core/fake-browser` | In-memory browser API for unit testing | [references/fake-browser.md](references/fake-browser.md) |
| `@webext-core/job-scheduler` | Background job scheduling via Alarms API | [references/job-scheduler.md](references/job-scheduler.md) |
| `@webext-core/isolated-element` | Shadow DOM containers for content script UIs | [references/isolated-element.md](references/isolated-element.md) |
| `@webext-core/storage` | localStorage-like wrapper (prefer WXT storage if using WXT) | [references/storage.md](references/storage.md) |
| Cross-package patterns and anti-patterns | — | [references/patterns.md](references/patterns.md) |

## Most Common Pattern

```ts
// services/counter.ts
import { defineProxyService } from '@webext-core/proxy-service';

const [registerCounter, getCounter] = defineProxyService('CounterService', () => {
  let count = 0;
  return {
    increment: () => ++count,
    getCount: () => count,
  };
});

export { registerCounter, getCounter };

// background.ts — register the real implementation
registerCounter();

// popup or content script — call via proxy (all methods return Promise)
const counter = getCounter();
const newCount = await counter.increment();
```
