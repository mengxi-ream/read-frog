---
name: wxt
description: Build browser extensions with WXT - a next-gen framework with file-based entrypoints, Vite builds, auto-imports, typed storage with migrations, content script UIs, and multi-browser MV2/MV3 support.
---

# WXT - Browser Extension Framework

## When to Use

Apply this skill when:
- Project has `wxt.config.ts` in root
- Code uses `defineBackground`, `defineContentScript`, `defineUnlistedScript`
- `package.json` has `wxt` as a dependency
- Entrypoints directory contains extension entry files
- Code imports from `#imports` or `wxt/*`

## Quick Reference

| Topic | Reference |
|-------|-----------|
| Configuration, manifest, env vars, TypeScript | [references/config.md](references/config.md) |
| Entrypoints (background, HTML pages, unlisted) | [references/entrypoints.md](references/entrypoints.md) |
| Content scripts (UI, main world, SPA) | [references/content-scripts.md](references/content-scripts.md) |
| Storage API, defineItem, migrations, watchers | [references/storage.md](references/storage.md) |
| Messaging (cross-context communication) | [references/messaging.md](references/messaging.md) |
| Testing with WxtVitest and fakeBrowser | [references/testing.md](references/testing.md) |
| WXT modules (using and creating) | [references/modules.md](references/modules.md) |
| Multi-browser builds and runtime detection | [references/multi-browser.md](references/multi-browser.md) |
| Vue, React, Svelte, Solid setup | [references/frontend-frameworks.md](references/frontend-frameworks.md) |
| Common patterns and anti-patterns | [references/patterns.md](references/patterns.md) |

## Most Common Pattern

```ts
// entrypoints/background.ts
export default defineBackground({
  main() {
    // ALL runtime code must be inside main() - cannot be async
    browser.runtime.onInstalled.addListener(() => {
      console.log('Extension installed');
    });
  },
});
```

**Critical**: `main()` cannot be `async`. Code outside `main()` runs at build time in Node.js.
