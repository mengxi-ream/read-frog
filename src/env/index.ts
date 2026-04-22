import { createEnv } from "@t3-oss/env-core"
import { createExtensionClientEnvSchema, resolveExtensionEnv } from "./shared"

const extensionClientEnvSchema = createExtensionClientEnvSchema(import.meta.env.PROD)

export const env = createEnv({
  clientPrefix: "WXT_",
  client: extensionClientEnvSchema,
  runtimeEnv: resolveExtensionEnv(import.meta.env),
  emptyStringAsUndefined: true,
})
