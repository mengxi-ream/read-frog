import { browser, storage } from "#imports"
import { z } from "zod"
import { supportsGoogleDriveSync } from "@/utils/platform"
import { GOOGLE_DRIVE_TOKEN_STORAGE_KEY } from "../constants/config"
import { logger } from "../logger"

const GOOGLE_CLIENT_ID = import.meta.env.WXT_GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID"
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/userinfo.email",
]
const TOKEN_EXPIRY_BUFFER_MS = 60000
export const GOOGLE_DRIVE_PLATFORM_UNSUPPORTED_ERROR_CODE = "PLATFORM_NOT_SUPPORTED"

const googleAuthTokenSchema = z.object({
  access_token: z.string(),
  expires_at: z.number(),
  token_type: z.string().default("Bearer"),
})

const googleUserInfoSchema = z.object({
  id: z.string(),
  email: z.email(),
  verified_email: z.boolean(),
  picture: z.url().optional(),
})

export type GoogleAuthToken = z.infer<typeof googleAuthTokenSchema>
export type GoogleUserInfo = z.infer<typeof googleUserInfoSchema>

export class GoogleDrivePlatformUnsupportedError extends Error {
  code = GOOGLE_DRIVE_PLATFORM_UNSUPPORTED_ERROR_CODE

  constructor(message = "Google Drive sync is not supported on this platform.") {
    super(message)
    this.name = "GoogleDrivePlatformUnsupportedError"
  }
}

export function isGoogleDrivePlatformUnsupportedError(
  error: unknown,
): error is GoogleDrivePlatformUnsupportedError {
  return error instanceof GoogleDrivePlatformUnsupportedError
    || (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === GOOGLE_DRIVE_PLATFORM_UNSUPPORTED_ERROR_CODE
    )
}

function createPlatformUnsupportedError(): GoogleDrivePlatformUnsupportedError {
  return new GoogleDrivePlatformUnsupportedError()
}

function getIdentityApi() {
  if (!supportsGoogleDriveSync) {
    throw createPlatformUnsupportedError()
  }

  const identity = browser.identity
  if (!identity?.getRedirectURL || !identity.launchWebAuthFlow) {
    throw createPlatformUnsupportedError()
  }

  return identity
}

/**
 * Get token from storage with validation
 */
async function getTokenFromStorage(): Promise<GoogleAuthToken | null> {
  try {
    const tokenData = await storage.getItem<GoogleAuthToken>(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`)
    if (!tokenData) {
      return null
    }

    const parsed = googleAuthTokenSchema.safeParse(tokenData)
    if (!parsed.success) {
      logger.warn("Invalid token data in storage", parsed.error)
      return null
    }

    return parsed.data
  }
  catch (error) {
    logger.error("Failed to get token from storage", error)
    return null
  }
}

/**
 * Authenticate with Google Drive using OAuth 2.0
 */
export async function authenticateGoogleDriveAndSaveTokenToStorage(): Promise<string> {
  try {
    const identity = getIdentityApi()
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
    authUrl.searchParams.set("response_type", "token")
    authUrl.searchParams.set("redirect_uri", identity.getRedirectURL())
    authUrl.searchParams.set("scope", GOOGLE_SCOPES.join(" "))
    authUrl.searchParams.set("prompt", "select_account")

    const responseUrl = await identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    })

    if (!responseUrl) {
      throw new Error("No response URL from Google OAuth")
    }

    const url = new URL(responseUrl)
    const params = new URLSearchParams(url.hash.slice(1))
    const accessToken = params.get("access_token")
    const expiresIn = params.get("expires_in")

    if (!accessToken) {
      throw new Error("No access token in OAuth response")
    }

    const expiresAt = Date.now() + (expiresIn ? Number.parseInt(expiresIn) * 1000 : 3600 * 1000)

    const tokenData: GoogleAuthToken = {
      access_token: accessToken,
      expires_at: expiresAt,
      token_type: "Bearer",
    }

    // Validate before storing
    const validatedToken = googleAuthTokenSchema.parse(tokenData)
    await storage.setItem(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`, validatedToken)

    return accessToken
  }
  catch (error) {
    logger.error("Google OAuth authentication failed", error)
    throw error
  }
}

/**
 * Get valid access token, re-authenticate if expired
 */
export async function getValidAccessToken(): Promise<string> {
  try {
    if (!supportsGoogleDriveSync) {
      throw createPlatformUnsupportedError()
    }

    const tokenData = await getTokenFromStorage()

    // Re-authenticate if token not found or expiring soon (within 1 minute)
    if (!tokenData || Date.now() >= tokenData.expires_at - TOKEN_EXPIRY_BUFFER_MS) {
      return await authenticateGoogleDriveAndSaveTokenToStorage()
    }

    // Trust local expiry check - validate only on API 401 errors
    return tokenData.access_token
  }
  catch (error) {
    logger.error("Failed to get valid access token", error)
    throw error
  }
}

export async function clearAccessToken(): Promise<void> {
  try {
    await storage.removeItem(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`)
  }
  catch (error) {
    logger.error("Failed to clear access token", error)
    throw error
  }
}

/**
 * Check if user is authenticated with valid token
 */
export async function getIsAuthenticated(): Promise<boolean> {
  try {
    if (!supportsGoogleDriveSync) {
      throw createPlatformUnsupportedError()
    }

    const tokenData = await getTokenFromStorage()

    if (!tokenData) {
      return false
    }

    return Date.now() < tokenData.expires_at - TOKEN_EXPIRY_BUFFER_MS
  }
  catch (error) {
    logger.error("Failed to check authentication status", error)
    if (isGoogleDrivePlatformUnsupportedError(error)) {
      throw error
    }

    return false
  }
}

/**
 * Fetch Google user info using access token
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  if (!supportsGoogleDriveSync) {
    throw createPlatformUnsupportedError()
  }

  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch user info: ${res.status}`)
  }

  const data = await res.json()
  const parsed = googleUserInfoSchema.safeParse(data)

  if (!parsed.success) {
    logger.error("Invalid user info response", parsed.error)
    throw new Error("Invalid user info response")
  }

  return parsed.data
}
