// Signs src/utils/site-rules/built-in/rules.json into the document installed
// extensions fetch (see src/utils/site-rules/remote/document.ts).
//
//   SITE_RULES_SIGNING_KEY='{"keyId":"…","privateKey":"…"}' \
//     node scripts/site-rules/sign.mjs --out <file> [--revision <unix seconds>] [--live-file <file>]
//
// --revision defaults to HEAD's commit time. --live-file is the document the
// bucket holds now (a missing file means nothing is published yet): the new
// one is only marked for publishing when its revision is higher, so re-running
// an old commit never rolls rules back. The result is written to
// $GITHUB_OUTPUT as publish=true|false when set.

import { execFileSync } from "node:child_process"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const FORMAT = 1

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    revision: { type: "string" },
    "live-file": { type: "string" },
    rules: { type: "string", default: path.join(ROOT, "src/utils/site-rules/built-in/rules.json") },
    "package-json": { type: "string", default: path.join(ROOT, "package.json") },
    "public-keys": {
      type: "string",
      default: path.join(ROOT, "src/utils/site-rules/remote/public-keys.json"),
    },
  },
})

function fail(message) {
  console.error(message)
  process.exit(1)
}

function base64ToBytes(base64) {
  return Uint8Array.from(Buffer.from(base64, "base64"))
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
  }
}

if (!values.out) fail("Usage: sign.mjs --out <file> [--revision <n>] [--live-file <file>]")

const secret = process.env.SITE_RULES_SIGNING_KEY
if (!secret) fail("SITE_RULES_SIGNING_KEY is not set")
const { keyId, privateKey } = JSON.parse(secret)
if (typeof keyId !== "string" || typeof privateKey !== "string") {
  fail('SITE_RULES_SIGNING_KEY must be {"keyId": "…", "privateKey": "<base64 PKCS#8>"}')
}

const revision = Number(
  values.revision ??
    execFileSync("git", ["show", "-s", "--format=%ct", "HEAD"], { cwd: ROOT, encoding: "utf8" }),
)
if (!Number.isSafeInteger(revision) || revision <= 0) fail(`Invalid revision: ${revision}`)

const rules = JSON.parse(await readFile(values.rules, "utf8"))
if (!Array.isArray(rules)) fail(`${values.rules} is not an array of rules`)
const { version: extensionVersion } = JSON.parse(await readFile(values["package-json"], "utf8"))

const payload = JSON.stringify({ format: FORMAT, revision, extensionVersion, rules })
const signingKey = await crypto.subtle.importKey(
  "pkcs8",
  base64ToBytes(privateKey),
  { name: "ECDSA", namedCurve: "P-256" },
  false,
  ["sign"],
)
const signature = new Uint8Array(
  await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(payload),
  ),
)

// Check against the public key the extension ships: a secret that does not
// match it would publish a document every install rejects.
const publicKeys = JSON.parse(await readFile(values["public-keys"], "utf8"))
if (!Object.hasOwn(publicKeys, keyId)) fail(`Key id "${keyId}" is not in ${values["public-keys"]}`)
const verifyingKey = await crypto.subtle.importKey(
  "spki",
  base64ToBytes(publicKeys[keyId]),
  { name: "ECDSA", namedCurve: "P-256" },
  false,
  ["verify"],
)
const verified = await crypto.subtle.verify(
  { name: "ECDSA", hash: "SHA-256" },
  verifyingKey,
  signature,
  new TextEncoder().encode(payload),
)
if (!verified) fail(`The signing key does not match public key "${keyId}"`)

if (values["live-file"]) {
  let liveText = null
  try {
    liveText = await readFile(values["live-file"], "utf8")
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  if (liveText) {
    const live = JSON.parse(JSON.parse(liveText).payload)
    if (live.revision >= revision) {
      console.log(`Published revision ${live.revision} is not older than ${revision}; skipping`)
      await setOutput("publish", "false")
      process.exit(0)
    }
  }
}

await mkdir(path.dirname(values.out), { recursive: true })
await writeFile(
  values.out,
  `${JSON.stringify({ keyId, payload, signature: Buffer.from(signature).toString("base64") })}\n`,
)
await setOutput("publish", "true")
console.log(`Signed ${rules.length} rules at revision ${revision} (extension ${extensionVersion})`)
