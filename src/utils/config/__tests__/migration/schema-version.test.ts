import { describe, expect, it } from 'vitest'
import { LATEST_SCHEMA_VERSION } from '../../migration'

describe('config Schema Version', () => {
  it('should have a valid schema version', () => {
    expect(LATEST_SCHEMA_VERSION).toBeDefined()
    expect(typeof LATEST_SCHEMA_VERSION).toBe('number')
  })
})
