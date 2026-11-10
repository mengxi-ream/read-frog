import { z } from "zod"
import publicKeys from "./public-keys.json"

/**
 * The published file: the document as a JSON string, signed with ECDSA P-256
 * over its UTF-8 bytes (WebCrypto's raw r||s signature, base64). P-256 rather
 * than Ed25519 because WebCrypto only has Ed25519 from Chrome 137 on, and this
 * extension supports older versions.
 */
export const signedSiteRulesSchema = z.object({
  keyId: z.string().min(1),
  payload: z.string().min(1),
  signature: z.string().min(1),
})

export type SignedSiteRules = z.infer<typeof signedSiteRulesSchema>

/**
 * Public halves of the keys CI signs with, by key id (see
 * scripts/site-rules/generate-signing-key.mjs). A new key must ship in a
 * release before CI signs with it.
 */
export const SITE_RULES_PUBLIC_KEYS: Readonly<Record<string, string>> = publicKeys

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

export async function verifySiteRulesSignature(
  signed: SignedSiteRules,
  keys: Readonly<Record<string, string>> = SITE_RULES_PUBLIC_KEYS,
): Promise<boolean> {
  const publicKey = Object.hasOwn(keys, signed.keyId) ? keys[signed.keyId] : undefined
  if (publicKey === undefined) {
    return false
  }
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      base64ToBytes(publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    )
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64ToBytes(signed.signature),
      new TextEncoder().encode(signed.payload),
    )
  } catch {
    return false
  }
}
