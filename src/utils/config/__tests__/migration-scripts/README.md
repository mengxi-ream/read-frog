# Migration Test System

This directory contains the automated testing system for configuration migrations.

## Automated Testing

### `all-migrations.test.ts`

This is the main test file that:

1. **Automatically discovers all versions**: From version 2 to the current `LATEST_SCHEMA_VERSION`
2. **Dynamically loads test data**: Automatically imports `../example/v{version}.ts` files
3. **Executes migration tests**: Calls `runMigration()` and validates results
4. **Displays description information**: Uses the `description` field from each version

### Test Structure

```typescript
// For each version, tests like this are generated
it('should migrate config from v5 to v6', async () => {
  // Automatically loads v005.ts and v006.ts
  // Executes migration
  // Validates results
})
```

## Adding Tests for New Versions

When you add a new migration version, you only need to:

1. **Create migration script**: `migration-scripts/v{from}-to-v{to}.ts`
2. **Create test data**:
   - `example/v{newVersion}.ts` - Configuration example for the new version
   - Export `configExample` and optional `description`

Tests will run automatically!

## Example Test Data File

```typescript
// example/v007.ts
export const configExample = {
  // New version configuration structure
}

export const description = 'Add autoTranslate feature'
```

## Running Tests

```bash
# Run all migration tests
pnpm test migration-scripts

# Verbose mode (shows description for each migration)
VITEST_VERBOSE=1 pnpm test migration-scripts
```

## Test Validation

The system validates:

- ✅ All migration scripts exist and are executable
- ✅ Migration results match expected configuration exactly
- ✅ Version numbers are configured correctly

## Benefits

- 🚀 **Zero configuration**: Adding new versions requires no test code modifications
- 🔄 **Automated**: Automatically tests all versions based on `LATEST_SCHEMA_VERSION`
- 📝 **Descriptive**: Test names include version and feature descriptions
- 🛡️ **Robust**: Gracefully handles missing test files
- 🎯 **Complete**: Ensures all migration scripts are tested
