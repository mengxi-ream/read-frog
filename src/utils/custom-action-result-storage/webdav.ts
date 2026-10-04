import type {
  CustomActionResultRecord,
  CustomActionResultStorageError,
  WebDavStorageSettings,
} from "./types"
import { customActionResultRecordSchema } from "./types"

const RECORD_FILE_PREFIX = "rf-entry-"
const RECORD_FILE_PATTERN = /^rf-entry-[0-9a-f-]{36}\.json$/i

export class CustomActionResultStorageProviderError extends Error {
  constructor(readonly code: CustomActionResultStorageError) {
    super(code)
    this.name = "CustomActionResultStorageProviderError"
  }
}

interface ValidWebDavSettings {
  baseUrl: URL
  directorySegments: string[]
  authorization?: string
}

function providerError(code: CustomActionResultStorageError): never {
  throw new CustomActionResultStorageProviderError(code)
}

function getValidatedSettings(settings: WebDavStorageSettings): ValidWebDavSettings {
  let baseUrl: URL
  try {
    baseUrl = new URL(settings.serverUrl.trim())
  } catch {
    return providerError("invalid_config")
  }

  if (
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:")
  ) {
    return providerError("invalid_config")
  }

  if (baseUrl.protocol === "http:" && !isLoopbackHost(baseUrl.hostname)) {
    return providerError("http_not_local")
  }

  if (settings.username.includes(":") || /[\r\n]/.test(settings.username + settings.password)) {
    return providerError("invalid_credentials")
  }

  const directorySegments = settings.directory
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)

  if (
    !directorySegments.length ||
    directorySegments.some((segment) => segment === "." || segment === "..")
  ) {
    return providerError("invalid_config")
  }

  const authorization =
    settings.username || settings.password
      ? `Basic ${encodeBasicCredentials(settings.username, settings.password)}`
      : undefined

  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "")

  return { baseUrl, directorySegments, authorization }
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1"
}

function encodeBasicCredentials(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function buildUrl(baseUrl: URL, encodedPathSegments: string[], trailingSlash: boolean): URL {
  const url = new URL(baseUrl)
  const prefix = baseUrl.pathname.replace(/\/+$/, "")
  const suffix = encodedPathSegments.length ? `/${encodedPathSegments.join("/")}` : ""
  url.pathname = `${prefix}${suffix}${trailingSlash ? "/" : ""}` || "/"
  return url
}

function getRecordFileUrl(settings: ValidWebDavSettings, id: string): URL {
  return buildUrl(
    settings.baseUrl,
    [...settings.directorySegments.map(encodeURIComponent), `${RECORD_FILE_PREFIX}${id}.json`],
    false,
  )
}

function decodeXmlText(value: string): string {
  const decoded = value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, name: string) => {
      if (name === "amp") return "&"
      if (name === "lt") return "<"
      if (name === "gt") return ">"
      if (name === "quot") return '"'
      if (name === "apos") return "'"
      const codePoint = name.startsWith("#x")
        ? Number.parseInt(name.slice(2), 16)
        : Number.parseInt(name.slice(1), 10)
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        providerError("invalid_response")
      }
      return String.fromCodePoint(codePoint)
    },
  )

  if (/&[^;\s]+;/.test(decoded)) {
    return providerError("invalid_response")
  }
  return decoded.trim()
}

/** Parse hrefs from a DAV:multistatus response without relying on DOMParser,
 * which is not available in extension service workers. Namespace prefixes are
 * optional and XML entities are decoded before URLs are resolved. */
export function parseWebDavMultistatus(xml: string): string[] {
  const namespacePrefix = "(?:[A-Za-z_][\\w.-]*:)?"
  const multistatusOpen = new RegExp(`<${namespacePrefix}multistatus\\b`, "i")
  const multistatusClose = new RegExp(`</${namespacePrefix}multistatus\\s*>`, "i")
  if (!multistatusOpen.test(xml) || !multistatusClose.test(xml)) {
    return providerError("invalid_response")
  }

  const responsePattern = new RegExp(
    `<${namespacePrefix}response\\b[^>]*>([\\s\\S]*?)</${namespacePrefix}response\\s*>`,
    "gi",
  )
  const hrefPattern = new RegExp(
    `<${namespacePrefix}href\\b[^>]*>([\\s\\S]*?)</${namespacePrefix}href\\s*>`,
    "i",
  )
  const hrefs: string[] = []

  for (const match of xml.matchAll(responsePattern)) {
    const hrefMatch = match[1]?.match(hrefPattern)
    if (hrefMatch?.[1] !== undefined) {
      hrefs.push(decodeXmlText(hrefMatch[1].replace(/<[^>]+>/g, "")))
    }
  }

  if (hrefs.length === 0) {
    return providerError("invalid_response")
  }
  return hrefs
}

export class CustomActionResultWebDavProvider {
  private readonly validatedSettings: ValidWebDavSettings

  constructor(
    settings: WebDavStorageSettings,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.validatedSettings = getValidatedSettings(settings)
  }

  async save(records: CustomActionResultRecord[]): Promise<void> {
    await this.ensureDirectory()
    for (const record of records) {
      await this.putRecord(record)
    }
  }

  async list(): Promise<CustomActionResultRecord[]> {
    const collectionUrl = this.collectionUrl()
    const hrefs = await this.propfind(collectionUrl)
    const recordUrls = hrefs
      .map((href) => this.resolveHref(collectionUrl, href))
      .filter((url): url is URL => url !== null)

    const records: CustomActionResultRecord[] = []
    for (const url of recordUrls) {
      const response = await this.request(url, { method: "GET" })
      if (response.status === 404) continue
      this.assertSuccessful(response)

      let body: unknown
      try {
        body = await response.json()
      } catch {
        return providerError("invalid_response")
      }
      const parsed = customActionResultRecordSchema.safeParse(body)
      if (!parsed.success) {
        return providerError("invalid_response")
      }
      records.push(parsed.data)
    }

    return records.sort((left, right) => right.createdAt - left.createdAt)
  }

  async delete(id: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return providerError("invalid_config")
    }
    const response = await this.request(getRecordFileUrl(this.validatedSettings, id), {
      method: "DELETE",
    })
    if (response.status === 404) return
    this.assertSuccessful(response)
  }

  async testConnection(): Promise<void> {
    await this.ensureDirectory()
    await this.propfind(this.collectionUrl())
  }

  private collectionUrl(): URL {
    return buildUrl(
      this.validatedSettings.baseUrl,
      this.validatedSettings.directorySegments.map(encodeURIComponent),
      true,
    )
  }

  private async ensureDirectory(): Promise<void> {
    const { baseUrl, directorySegments } = this.validatedSettings
    for (let index = 0; index < directorySegments.length; index++) {
      const url = buildUrl(
        baseUrl,
        directorySegments.slice(0, index + 1).map(encodeURIComponent),
        true,
      )
      const response = await this.request(url, { method: "MKCOL" })
      if (response.status === 405) continue
      this.assertSuccessful(response)
    }
  }

  private async putRecord(record: CustomActionResultRecord): Promise<void> {
    let body: string
    try {
      body = JSON.stringify(customActionResultRecordSchema.parse(record))
    } catch {
      return providerError("invalid_response")
    }
    const response = await this.request(getRecordFileUrl(this.validatedSettings, record.id), {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body,
    })
    this.assertSuccessful(response)
  }

  private async propfind(collectionUrl: URL): Promise<string[]> {
    const response = await this.request(collectionUrl, {
      method: "PROPFIND",
      headers: {
        Depth: "1",
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
    })
    if (response.status !== 207) {
      this.assertSuccessful(response)
      return providerError("invalid_response")
    }
    let xml: string
    try {
      xml = await response.text()
    } catch {
      return providerError("invalid_response")
    }
    return parseWebDavMultistatus(xml)
  }

  private resolveHref(collectionUrl: URL, href: string): URL | null {
    let url: URL
    try {
      url = new URL(href, collectionUrl)
    } catch {
      return providerError("invalid_response")
    }
    if (url.origin !== collectionUrl.origin || url.search || url.hash) {
      return null
    }

    const pathPrefix = collectionUrl.pathname.endsWith("/")
      ? collectionUrl.pathname
      : `${collectionUrl.pathname}/`
    if (!url.pathname.startsWith(pathPrefix)) return null
    const relativePath = url.pathname.slice(pathPrefix.length)
    if (relativePath.includes("/") || !RECORD_FILE_PATTERN.test(relativePath)) return null
    return url
  }

  private async request(url: URL, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    if (this.validatedSettings.authorization) {
      headers.set("Authorization", this.validatedSettings.authorization)
    }

    try {
      return await this.fetcher(url, { ...init, headers, redirect: "error" })
    } catch {
      return providerError("network_error")
    }
  }

  private assertSuccessful(response: Response): void {
    if (response.ok) return
    if (response.status === 401) return providerError("unauthorized")
    if (response.status === 403) return providerError("forbidden")
    if (response.status === 404) return providerError("not_found")
    if (response.status === 409) return providerError("directory_missing")
    return providerError("server_error")
  }
}
