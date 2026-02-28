---
name: migration-scripts
description: Use when writing or reviewing database/config migration scripts. Enforces that migrations are frozen snapshots with no external imports.
metadata:
  author: read-frog
  version: "1.0.0"
---

# Migration Scripts

## Rule: Migrations Are Frozen Snapshots

Migration scripts must NEVER import or reference:
- Constants, helpers, or utilities from the main codebase
- Shared types (use `any` for migration input/output)
- Factory functions like `createXxx()`

**Why:** The codebase evolves. A migration written today references code that may change tomorrow. When that constant changes, the migration silently breaks — it now migrates to the *new* shape, not the shape that existed when the migration was written.

## Checklist

- [ ] All values are hardcoded inline (no imports from `src/`)
- [ ] Input and output typed as `any`
- [ ] No calls to factory functions or helpers
- [ ] Default values are literal objects, not references to constants
- [ ] Migration is idempotent (safe to re-run)
