import { browser, storage } from '#imports'
import { z } from 'zod'
import { GOOGLE_DRIVE_TOKEN_STORAGE_KEY } from '../constants/config'
import { logger } from '../logger'

const GOOGLE_CLIENT_ID = import.meta.env.WXT_GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID'
const GOOGLE_REDIRECT_URI = browser.identity.getRedirectURL()
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
]
const TOKEN_EXPIRY_BUFFER_MS = 60000

export interface GoogleAuthToken {
  access_token: string
  expires_at: number
  token_type: string
}

const googleAuthTokenSchema = z.object({
  access_token: z.string(),
  expires_at: z.number(),
  token_type: z.string().default('Bearer'),
})

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
      logger.warn('Invalid token data in storage', parsed.error)
      return null
    }

    return parsed.data
  }
  catch (error) {
    logger.error('Failed to get token from storage', error)
    return null
  }
}

/**
 * Authenticate with Google Drive using OAuth 2.0
 */
export async function authenticateGoogleDrive(): Promise<string> {
  try {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'token')
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
    authUrl.searchParams.set('scope', GOOGLE_SCOPES.join(' '))
    authUrl.searchParams.set('prompt', 'select_account')

    const responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    })

    if (!responseUrl) {
      throw new Error('No response URL from Google OAuth')
    }

    const url = new URL(responseUrl)
    const params = new URLSearchParams(url.hash.slice(1))
    const accessToken = params.get('access_token')
    const expiresIn = params.get('expires_in')

    if (!accessToken) {
      throw new Error('No access token in OAuth response')
    }

    const expiresAt = Date.now() + (expiresIn ? Number.parseInt(expiresIn) * 1000 : 3600 * 1000)

    const tokenData: GoogleAuthToken = {
      access_token: accessToken,
      expires_at: expiresAt,
      token_type: 'Bearer',
    }

    // Validate before storing
    const validatedToken = googleAuthTokenSchema.parse(tokenData)
    await storage.setItem(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`, validatedToken)

    return accessToken
  }
  catch (error) {
    logger.error('Google OAuth authentication failed', error)
    throw error
  }
}

/**
 * Get valid access token, re-authenticate if expired
 */
export async function getValidAccessToken(): Promise<string> {
  try {
    const tokenData = await getTokenFromStorage()

    // Re-authenticate if token not found or expiring soon (within 1 minute)
    if (!tokenData || Date.now() >= tokenData.expires_at - TOKEN_EXPIRY_BUFFER_MS) {
      return await authenticateGoogleDrive()
    }

    // Trust local expiry check - validate only on API 401 errors
    return tokenData.access_token
  }
  catch (error) {
    logger.error('Failed to get valid access token', error)
    throw error
  }
}

export async function clearAccessToken(): Promise<void> {
  try {
    await storage.removeItem(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`)
  }
  catch (error) {
    logger.error('Failed to clear access token', error)
    throw error
  }
}

/**
 * Check if user is authenticated with valid token
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const tokenData = await getTokenFromStorage()

    if (!tokenData) {
      return false
    }

    return Date.now() < tokenData.expires_at - TOKEN_EXPIRY_BUFFER_MS
  }
  catch (error) {
    logger.error('Failed to check authentication status', error)
    return false
  }
}
