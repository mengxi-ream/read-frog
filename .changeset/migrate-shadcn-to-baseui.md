---
"@anthropic/read-frog": minor
---

refactor(ui): migrate shadcn components to base-ui

- Migrate all shadcn components to base-ui implementations
- Remove shadcn dependencies (class-variance-authority, tailwind-merge, clsx)
- Add Firefox compatibility layer for base-ui components
- Consolidate UI component library to reduce bundle size
