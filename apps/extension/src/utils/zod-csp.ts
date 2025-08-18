// Zod CSP compatibility configuration for Firefox extensions
// This must be imported before any Zod schemas are created
import { z } from 'zod'

// Configure Zod to disable JIT compilation to avoid CSP eval violations
z.config({ jitless: true })

export { z }
