/**
 * Turns whatever a call site logged into a small, JSON-safe value that is safe to
 * keep on disk and hand to the user in a diagnostics export:
 *
 * - string values under secret-looking keys (`apiKey`, `token`, `authorization`…)
 *   become "[redacted]";
 * - bulk request content (`body`, `messages`, `prompt`…) becomes "[omitted]";
 * - page text belongs under the key `text`, which keeps only a short preview, the
 *   length and a hash, so two records about one paragraph can still be matched;
 * - every web URL is cut to its origin, which drops paths, query strings and the
 *   keys some providers put in them, and a local file's URL loses its path, which
 *   names the user and their folders; the extension's own URLs, which stack
 *   frames are made of, stay whole;
 * - Errors become `{ name, message, stack, ... }`, since `JSON.stringify` turns an
 *   Error into `{}`, and the stack keeps only its frames, since the message is
 *   kept already, capped;
 * - long strings, big arrays, wide or deep objects and cycles are cut short.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject
export interface JsonObject {
  [key: string]: JsonValue
}

/** How much of a paragraph's text a record keeps. */
export const TEXT_PREVIEW_LENGTH = 60

const MAX_STRING_LENGTH = 300
const MAX_MESSAGE_LENGTH = 500
const MAX_STACK_LENGTH = 2000
const MAX_ARRAY_ITEMS = 20
const MAX_OBJECT_KEYS = 50
const MAX_DEPTH = 4
const MAX_FIELDS_JSON_LENGTH = 8000

const SECRET_KEY_PATTERN =
  /api[-_]?key|secret|password|passwd|token|authorization|cookie|credential|session[-_]?key/i
const OMITTED_KEYS = new Set(["body", "requestBodyValues", "messages", "prompt", "html"])
// Not every scheme: chrome-extension:// and moz-extension:// URLs are the stack frames.
const URL_PATTERN = /\b(?:https?|wss?|file):\/\/[^\s"'<>()[\]{}]+/g

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}… (+${value.length - maxLength})`
    : value
}

function stripUrls(value: string): string {
  return value.replace(URL_PATTERN, (url) => {
    // Such as a framed local page Chrome would not let the extension into.
    if (url.startsWith("file:")) return "file:///[path]"
    try {
      return new URL(url).origin
    } catch {
      return "[url]"
    }
  })
}

function sanitizeString(value: string, maxLength = MAX_STRING_LENGTH): string {
  return truncate(stripUrls(value), maxLength)
}

/** FNV-1a, 32 bits: enough to tell paragraphs apart inside one export. */
function shortHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function previewText(text: string): JsonObject {
  const collapsed = text.replace(/\s+/g, " ").trim()
  const characters = Array.from(collapsed)
  const preview =
    characters.length > TEXT_PREVIEW_LENGTH
      ? `${characters.slice(0, TEXT_PREVIEW_LENGTH).join("")}…`
      : collapsed
  return { preview: stripUrls(preview), length: text.length, hash: shortHash(text) }
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** `instanceof Error` misses errors thrown in another realm, such as the page's own world. */
function isErrorLike(value: object): value is Error {
  if (value instanceof Error) return true
  const candidate = value as Partial<Error>
  return (
    typeof candidate.name === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.stack === "string"
  )
}

/**
 * A V8 stack opens with "Name: message", the whole message however long it is,
 * which the record keeps already, capped: leave the frames. Firefox and Safari
 * stacks are frames only.
 */
function getStackFrames(stack: string, message: string): string {
  const index = message ? stack.indexOf(message) : -1
  if (index !== -1 && /^(?:[^\n]*: )?$/.test(stack.slice(0, index))) {
    const rest = stack.slice(index + message.length)
    if (rest === "" || rest.startsWith("\n")) return rest.slice(1)
  }
  // The message changed after the stack was written, or there was none: the
  // opening is whatever comes before the first frame.
  const firstFrame = stack.search(/^ {4}at /m)
  return firstFrame === -1 ? stack : stack.slice(firstFrame)
}

function sanitizeError(error: Error, depth: number, seen: WeakSet<object>): JsonObject {
  const result: JsonObject = {
    name: error.name,
    message: sanitizeString(error.message, MAX_MESSAGE_LENGTH),
  }
  const frames = error.stack ? getStackFrames(error.stack, error.message) : ""
  if (frames) result.stack = truncate(stripUrls(frames), MAX_STACK_LENGTH)
  // Status codes and error codes live on the error object itself. A plain object
  // shaped like an error lists its stack among its keys: that stack was handled
  // above, even when nothing of it was kept.
  for (const key of Object.keys(error).slice(0, MAX_OBJECT_KEYS)) {
    if (key === "stack" || key in result) continue
    result[key] = sanitizeEntry(
      key,
      (error as unknown as Record<string, unknown>)[key],
      depth + 1,
      seen,
    )
  }
  if (error.cause !== undefined) result.cause = sanitizeValue(error.cause, depth + 1, seen)
  return result
}

function sanitizeEntry(
  key: string,
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): JsonValue {
  if (OMITTED_KEYS.has(key)) return "[omitted]"
  if (typeof value === "string") {
    if (SECRET_KEY_PATTERN.test(key)) return "[redacted]"
    if (key === "text") return previewText(value)
  }
  return sanitizeValue(value, depth, seen)
}

function sanitizeObject(value: object, depth: number, seen: WeakSet<object>): JsonObject {
  const result: JsonObject = {}
  const keys = Object.keys(value)
  for (const key of keys.slice(0, MAX_OBJECT_KEYS)) {
    const entry = (value as Record<string, unknown>)[key]
    if (entry === undefined) continue
    result[key] = sanitizeEntry(key, entry, depth + 1, seen)
  }
  if (keys.length > MAX_OBJECT_KEYS) result["…"] = `${keys.length - MAX_OBJECT_KEYS} more keys`
  return result
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): JsonValue {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return sanitizeString(value)
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value)
  if (typeof value === "boolean") return value
  if (typeof value === "bigint" || typeof value === "symbol") return value.toString()
  if (typeof value === "function") return "[function]"
  // Every other kind of value is handled above.
  if (typeof value !== "object") return "[unknown]"

  if (seen.has(value)) return "[circular]"
  if (depth > MAX_DEPTH) return "[…]"
  seen.add(value)
  try {
    if (isErrorLike(value)) return sanitizeError(value, depth, seen)
    if (value instanceof Date)
      return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString()
    if (typeof Node !== "undefined" && value instanceof Node) {
      return value instanceof Element ? `<${value.tagName.toLowerCase()}>` : value.nodeName
    }
    if (Array.isArray(value) || value instanceof Set) {
      const items = [...value]
      const result = items
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => sanitizeValue(item, depth + 1, seen))
      if (items.length > MAX_ARRAY_ITEMS) result.push(`… ${items.length - MAX_ARRAY_ITEMS} more`)
      return result
    }
    if (value instanceof Map) return sanitizeObject(Object.fromEntries(value), depth, seen)
    if (!isPlainObject(value) && typeof (value as { toJSON?: unknown }).toJSON === "function") {
      return sanitizeValue((value as { toJSON: () => unknown }).toJSON(), depth, seen)
    }
    return sanitizeObject(value, depth, seen)
  } finally {
    seen.delete(value)
  }
}

export function sanitizeLogFields(fields: Readonly<Record<string, unknown>>): JsonObject {
  const result = sanitizeObject(fields, 0, new WeakSet())
  const json = JSON.stringify(result)
  return json.length > MAX_FIELDS_JSON_LENGTH
    ? { truncated: `${json.slice(0, MAX_FIELDS_JSON_LENGTH)}…` }
    : result
}

export function sanitizeLogMessage(message: string): string {
  return sanitizeString(message, MAX_MESSAGE_LENGTH)
}

/** Settings that hold a service's address, where some services take the key in the path or query. */
const ENDPOINT_KEYS = new Set(["baseURL", "url"])

function isEmpty(value: unknown): boolean {
  return value === "" || value === null || value === undefined
}

/** An endpoint cut to its origin, the way log records keep URLs; anything else could hold a key. */
function redactEndpoint(value: string): string {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "[redacted]"
  } catch {
    return "[redacted]"
  }
}

function redactEntry(key: string, entry: unknown): unknown {
  // A user's own request headers are free-form and often carry the key under a
  // name of the service's choosing: keep the names, never the values.
  if (key === "headers" && entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
    return Object.fromEntries(
      Object.entries(entry).map(([name, value]) => [name, isEmpty(value) ? value : "[redacted]"]),
    )
  }
  if (typeof entry !== "string" || entry === "") return redactSecrets(entry)
  if (SECRET_KEY_PATTERN.test(key)) return "[redacted]"
  if (ENDPOINT_KEYS.has(key)) return redactEndpoint(entry)
  return entry
}

/**
 * A copy of `value` for the settings in a diagnostics export, with every
 * credential a user can type in removed, at any depth and with nothing else
 * cut: strings under secret-looking keys, everything after the origin of a
 * service address, and the values of custom request headers. An empty value
 * stays empty, since "no key" is often the very thing to diagnose.
 */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (value === null || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, redactEntry(key, entry)]),
  )
}
