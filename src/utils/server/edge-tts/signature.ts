import {
  EDGE_TTS_ENDPOINT_URL,
  EDGE_TTS_SIGNATURE_APP_ID,
  getEdgeTTSSignatureSecretBase64,
} from './constants'
import { EdgeTTSError } from './errors'

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binaryString = ''
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i])
  }
  return btoa(binaryString)
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const keyBuffer = new ArrayBuffer(key.byteLength)
  new Uint8Array(keyBuffer).set(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(data),
  )
  return new Uint8Array(signatureBuffer)
}

export function buildSignatureDate(date = new Date()): string {
  return `${date.toUTCString().replace(/GMT/, '').trim().toLowerCase()} GMT`
}

export async function generateTranslatorSignature(
  url = EDGE_TTS_ENDPOINT_URL,
  now = new Date(),
): Promise<string> {
  try {
    const encodedUrl = encodeURIComponent(url.split('://')[1] ?? '')
    const requestId = crypto.randomUUID().replace(/-/g, '')
    const formattedDate = buildSignatureDate(now)

    const payload = `${EDGE_TTS_SIGNATURE_APP_ID}${encodedUrl}${formattedDate}${requestId}`.toLowerCase()
    const key = base64ToBytes(getEdgeTTSSignatureSecretBase64())
    const signature = await hmacSha256(key, payload)

    return `${EDGE_TTS_SIGNATURE_APP_ID}::${bytesToBase64(signature)}::${formattedDate}::${requestId}`
  }
  catch (error) {
    throw new EdgeTTSError('SIGNATURE_GENERATION_FAILED', 'Failed to generate translator signature', {
      cause: error,
    })
  }
}
