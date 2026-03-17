---
name: migration-scripts
description: Use when writing or reviewing database/config migration scripts or migration registries. Enforces frozen-snapshot migrations, safe registration, and lean import boundaries.
metadata:
  author: read-frog
  version: "1.1.0"
---

# Migration Scripts

## Rule: Migrations Are Frozen Snapshots

Migration scripts must NEVER import or reference:
- Constants, helpers, or utilities from the main codebase
- Shared types (use `any` for migration input/output)
- Factory functions like `createXxx()`

**Why:** The codebase evolves. A migration written today references code that may change tomorrow. When that constant changes, the migration silently breaks — it now migrates to the *new* shape, not the shape that existed when the migration was written.

## Rule: Migration Registries Must Validate the Chain

In this repo, config migration registries should auto-discover migration files from `src/utils/config/migration-scripts/v*-to-v*.ts` (for example via `import.meta.glob`), and the registry must:
- Parse both `fromVersion` and `toVersion` from the filename
- Reject invalid steps like `v001-to-v003`
- Reject duplicate target versions
- Reject discontinuous chains

Do not silently map only the target version and assume filenames are correct.

## Rule: Keep Migration Imports Off Hot Paths

Do not let generic config read helpers or content-script paths import migration registries unless they really perform migration.

Prefer to isolate migration-aware reads/writes into dedicated modules for import/sync/restore flows, so normal runtime paths do not bundle all migration scripts unnecessarily.

## Checklist

- [ ] All values are hardcoded inline (no imports from `src/`)
- [ ] Input and output typed as `any`
- [ ] No calls to factory functions or helpers
- [ ] Default values are literal objects, not references to constants
- [ ] Migration is idempotent (safe to re-run)
- [ ] Auto-discovered registries validate `from -> to` continuity and duplicate targets
- [ ] Migration-aware storage logic is isolated from generic read paths