import { z } from "zod"

// Disable Zod JIT (new Function) to avoid CSP eval violation in MV3 extensions
// https://github.com/colinhacks/zod/issues/4360
z.config({ jitless: true })
