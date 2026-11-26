// Generates a key pair for signing the remote site rules.
//
//   node scripts/site-rules/generate-signing-key.mjs --key-id 2026-11 --secret-out <file>
//
// The private key goes to --secret-out (created with 0600 permissions, never
// overwritten). Its contents are the SITE_RULES_SIGNING_KEY secret that
// .github/workflows/publish-site-rules.yml signs with. The public key is added
// to src/utils/site-rules/remote/public-keys.json, which ships in the extension.
// A new key only verifies in builds that ship it, so release the public key
// before CI signs with the new private key.

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

const DEFAULT_PUBLIC_KEYS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/utils/site-rules/remote/public-keys.json",
)

const { values } = parseArgs({
  options: {
    "key-id": { type: "string" },
    "secret-out": { type: "string" },
    "public-keys": { type: "string", default: DEFAULT_PUBLIC_KEYS_PATH },
  },
})

const keyId = values["key-id"]
const secretOut = values["secret-out"]
if (!keyId || !secretOut) {
  console.error("Usage: generate-signing-key.mjs --key-id <id> --secret-out <file>")
  process.exit(1)
}

let publicKeys = {}
try {
  publicKeys = JSON.parse(await readFile(values["public-keys"], "utf8"))
} catch (error) {
  if (error.code !== "ENOENT") throw error
}
if (Object.hasOwn(publicKeys, keyId)) {
  console.error(`Key id "${keyId}" is already in ${values["public-keys"]}`)
  process.exit(1)
}

const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
)
const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", privateKey)).toString("base64")
const spki = Buffer.from(await crypto.subtle.exportKey("spki", publicKey)).toString("base64")

// "wx" fails instead of overwriting an existing key file.
await writeFile(secretOut, `${JSON.stringify({ keyId, privateKey: pkcs8 })}\n`, {
  mode: 0o600,
  flag: "wx",
})
publicKeys[keyId] = spki
await writeFile(values["public-keys"], `${JSON.stringify(publicKeys, null, 2)}\n`)

console.log(`Private key written to ${secretOut}`)
console.log(`Public key "${keyId}" added to ${values["public-keys"]}`)
