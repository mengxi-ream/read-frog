import type { SignedSiteRules } from "../signature"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import process from "node:process"
import { TextEncoder as NodeTextEncoder } from "node:util"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import rawBuiltInRules from "../../built-in/rules.json"
import { remoteSiteRulesDocumentSchema } from "../document"
import { signedSiteRulesSchema, verifySiteRulesSignature } from "../signature"

const GENERATE_SCRIPT = path.resolve("scripts/site-rules/generate-signing-key.mjs")
const SIGN_SCRIPT = path.resolve("scripts/site-rules/sign.mjs")
// Each case starts the publishing scripts as Node processes, which takes
// longer than the default 5 s on a busy machine.
const SCRIPT_TIMEOUT_MS = 30_000

let dir: string
let keyCount = 0

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "site-rules-signature-"))
  // vitest.setup.ts replaces TextEncoder with one that only encodes ASCII
  // right, and rules.json is not all ASCII. Verify the real UTF-8 bytes the
  // scripts signed, as a browser would.
  vi.stubGlobal("TextEncoder", NodeTextEncoder)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

function generateKey(keyId: string, publicKeysPath: string) {
  const secretPath = path.join(dir, `secret-${++keyCount}.json`)
  execFileSync(process.execPath, [
    GENERATE_SCRIPT,
    "--key-id",
    keyId,
    "--secret-out",
    secretPath,
    "--public-keys",
    publicKeysPath,
  ])
  return readFileSync(secretPath, "utf8")
}

function sign(
  secret: string,
  publicKeysPath: string,
  extraArgs: string[] = [],
): { publish: string; signed: SignedSiteRules | null } {
  const outPath = path.join(dir, "site-rules.json")
  // A file of its own, so a run inside CI does not write the job's step outputs.
  const githubOutputPath = path.join(dir, "github-output")
  rmSync(outPath, { force: true })
  writeFileSync(githubOutputPath, "")
  execFileSync(
    process.execPath,
    [
      SIGN_SCRIPT,
      "--out",
      outPath,
      "--revision",
      "1762800000",
      "--public-keys",
      publicKeysPath,
      ...extraArgs,
    ],
    {
      env: { ...process.env, GITHUB_OUTPUT: githubOutputPath, SITE_RULES_SIGNING_KEY: secret },
      stdio: "pipe",
    },
  )
  return {
    publish: readFileSync(githubOutputPath, "utf8").trim(),
    signed: existsSync(outPath)
      ? signedSiteRulesSchema.parse(JSON.parse(readFileSync(outPath, "utf8")))
      : null,
  }
}

describe("site rules signatures", () => {
  it(
    "verify what the publishing scripts sign, and nothing altered",
    async () => {
      const publicKeysPath = path.join(dir, "public-keys.json")
      const result = sign(generateKey("test", publicKeysPath), publicKeysPath)
      const keys = JSON.parse(readFileSync(publicKeysPath, "utf8")) as Record<string, string>
      expect(result.publish).toBe("publish=true")
      const signed = result.signed!

      expect(await verifySiteRulesSignature(signed, keys)).toBe(true)
      const remote = remoteSiteRulesDocumentSchema.parse(JSON.parse(signed.payload))
      expect(remote).toMatchObject({
        format: 1,
        revision: 1_762_800_000,
        extensionVersion: JSON.parse(readFileSync("package.json", "utf8")).version,
      })
      expect(remote.rules).toEqual(rawBuiltInRules)

      const tampered = signed.payload.replace('"format":1', '"format":1 ')
      expect(await verifySiteRulesSignature({ ...signed, payload: tampered }, keys)).toBe(false)
      expect(await verifySiteRulesSignature({ ...signed, keyId: "unknown" }, keys)).toBe(false)
      expect(await verifySiteRulesSignature({ ...signed, signature: "%%%" }, keys)).toBe(false)
      // The shipped keys do not include this test key.
      expect(await verifySiteRulesSignature(signed)).toBe(false)
    },
    SCRIPT_TIMEOUT_MS,
  )

  it(
    "refuse to sign with a key the extension does not ship",
    () => {
      const secret = generateKey("unshipped", path.join(dir, "other-public-keys.json"))
      const publicKeysPath = path.join(dir, "public-keys.json")
      generateKey("shipped", publicKeysPath)

      expect(() => sign(secret, publicKeysPath)).toThrow(/Key id "unshipped" is not in/)
    },
    SCRIPT_TIMEOUT_MS,
  )

  it(
    "refuse a signing key that does not match the shipped public key of its id",
    () => {
      const publicKeysPath = path.join(dir, "public-keys.json")
      generateKey("test", publicKeysPath)
      // Same key id, different key pair.
      const otherSecret = generateKey("test", path.join(dir, "other-public-keys.json"))

      expect(() => sign(otherSecret, publicKeysPath)).toThrow(
        /The signing key does not match public key "test"/,
      )
    },
    SCRIPT_TIMEOUT_MS,
  )

  it(
    "only mark a document for publishing when it is newer than the published one",
    () => {
      const publicKeysPath = path.join(dir, "public-keys.json")
      const secret = generateKey("test", publicKeysPath)
      const livePath = path.join(dir, "live.json")
      const publishLiveRevision = (revision: number) =>
        writeFileSync(
          livePath,
          JSON.stringify({
            keyId: "test",
            payload: JSON.stringify({ format: 1, revision, extensionVersion: "1.0.0", rules: [] }),
            signature: "",
          }),
        )

      // Nothing published yet: no file to read.
      expect(sign(secret, publicKeysPath, ["--live-file", livePath]).publish).toBe("publish=true")

      publishLiveRevision(1_762_799_999)
      expect(sign(secret, publicKeysPath, ["--live-file", livePath]).publish).toBe("publish=true")

      // A re-run of an older commit must not roll the published rules back.
      for (const revision of [1_762_800_000, 1_900_000_000]) {
        publishLiveRevision(revision)
        expect(sign(secret, publicKeysPath, ["--live-file", livePath])).toEqual({
          publish: "publish=false",
          signed: null,
        })
      }
    },
    SCRIPT_TIMEOUT_MS,
  )
})
