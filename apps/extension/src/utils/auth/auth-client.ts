import { createAuthClient } from 'better-auth/react'
import { sendMessage } from '@/utils/message'
import { WEBSITE_URL } from '../constants/url'
import { normalizeHeaders } from '../http'

export const authClient = createAuthClient({
  baseURL: WEBSITE_URL,
  fetchOptions: {
    // Use background proxy to avoid CORS in content scripts
    customFetchImpl: async (input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> => {
      const inputUrl = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url)
      const url = inputUrl.startsWith('http')
        ? inputUrl
        : `${WEBSITE_URL}${inputUrl.startsWith('/') ? '' : '/'}${inputUrl}`

      const method = init?.method
      const headers = normalizeHeaders(init?.headers)
      const body = typeof init?.body === 'string' ? init.body : undefined

      const resp = await sendMessage('backgroundFetch', {
        url,
        method,
        headers,
        body,
        credentials: 'include',
      })

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: new Headers(resp.headers),
      })
    },
  },
})
