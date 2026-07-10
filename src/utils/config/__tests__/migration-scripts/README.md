# Migration Test System

This directory contains the automated testing system for configuration migrations, supporting both legacy single-example and modern multi-series test structures.

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
it("should migrate config from v5 to v6", async () => {
  // Automatically loads v005.ts and v006.ts
  // Executes migration
  // Validates results
})
```

## Test Structure Options

The new approach supporting multiple test scenarios per version:

```typescript
// example/v007.ts
import type { TestSeriesObject } from "./types"

export const description = "Add autoTranslate feature"
export const configExample = {/* legacy compatibility */}

// New multi-series structure
export const testSeries: TestSeriesObject = {
  default: {
    description: "Standard migration case",
    config: configExample, // Reuse for backward compatibility
  },
  "empty-patterns": {
    description: "Edge case with empty autoTranslatePatterns",
    config: {
      // Different configuration scenario
    },
  },
  "multiple-patterns": {
    description: "Complex case with multiple patterns",
    config: {
      // Another configuration scenario
    },
  },
}
```

## Adding Tests for New Versions

When you add a new migration version, you have two options:

1. **Create migration script**: `migration-scripts/v{from}-to-v{to}.ts`
2. **Create comprehensive test data**:
   - `example/v{newVersion}.ts` - Multiple test scenarios
   - Import types: `import type { TestSeriesObject } from './types'`
   - Export `configExample` and `description` for backward compatibility
   - Export `testSeries` object with multiple scenarios

**Tests run automatically for both approaches!**

## Multi-Series Test Benefits

- **Comprehensive Coverage**: Test multiple scenarios per version
- **Edge Case Testing**: Validate unusual configurations and boundary conditions
- **Automatic Discovery**: Series are automatically detected based on presence in consecutive versions
- **Backward Compatibility**: Legacy single-example tests continue to work
- **Rich Scenarios**: Test empty configs, max values, unicode content, and more

## How Multi-Series Testing Works

1. **Automatic Detection**: The test runner checks if both old and new version files have `testSeries`
2. **Series Matching**: Only series that exist in both versions are tested
3. **Individual Migration**: Each series is migrated and validated independently
4. **Fallback Support**: Falls back to legacy `configExample` if `testSeries` is not present

## Example Multi-Series Test Data

```typescript
// example/v016.ts - Translation mode migration
import type { TestSeriesObject } from "./types"

export const description = "Add translation mode"
export const configExample = {/* standard config */}

export const testSeries: TestSeriesObject = {
  default: {
    description: "Standard bilingual mode migration",
    config: configExample,
  },
  "translation-only": {
    description: "Edge case: translation-only mode",
    config: {
      translate: {
        mode: "translation-only", // Different mode
        // ... other config
      },
    },
  },
  "boundary-values": {
    description: "Edge case: minimum/maximum values",
    config: {
      translate: {
        requestQueueConfig: {
          capacity: 1, // Minimum
          rate: 1, // Minimum
        },
      },
    },
  },
  "unicode-patterns": {
    description: "Edge case: unicode in patterns",
    config: {
      translate: {
        autoTranslatePatterns: ["*.中文.com", "παγιά.gr"],
      },
    },
  },
}
```

## Running Tests

```bash
# Run all migration tests (both legacy and multi-series)
pnpm test migration-scripts

# Verbose mode (shows description for each migration and test series)
VITEST_VERBOSE=1 pnpm test migration-scripts

# Test specific version migrations
pnpm test -- --grep "v015"

# Run with coverage
pnpm test:cov migration-scripts
```

## Verbose Output Examples

### Legacy Structure Output:

```
✓ Migration v14 -> v15: Add selectionToolbar
```

### Multi-Series Structure Output:

```
✓ Migration v15 -> v16 [default]: Standard bilingual mode migration
✓ Migration v15 -> v16 [translation-only]: Edge case: translation-only mode
✓ Migration v15 -> v16 [boundary-values]: Edge case: minimum/maximum values
⚠ Skipping series "unicode-patterns" - not present in v16
```

## Test Validation

The system validates:

- ✅ All migration scripts exist and are executable
- ✅ Migration results match expected configuration exactly
- ✅ Version numbers are configured correctly

## Benefits

- 🎯 **Comprehensive**: Test multiple scenarios per migration
- 🔬 **Edge Cases**: Validate boundary conditions and unusual configurations
- 📊 **Rich Coverage**: Test empty configs, extreme values, unicode, and complex combinations
- 🔍 **Automatic Discovery**: No manual series registration required
- 🔄 **Series Continuity**: Test series that span multiple versions automatically
- 📝 **Descriptive**: Each series has its own description for clear test reporting
- ⚡ **Performance**: Run many test scenarios without creating separate test files
- 🛡️ **Backward Compatible**: Legacy tests continue to work unchanged
