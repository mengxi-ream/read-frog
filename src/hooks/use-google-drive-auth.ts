import type { GoogleUserInfo } from '@/utils/google-drive/auth'
import { storage } from '#imports'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { GOOGLE_DRIVE_TOKEN_STORAGE_KEY } from '@/utils/constants/config'
import { getGoogleUserInfo, getIsAuthenticated, getValidAccessToken } from '@/utils/google-drive/auth'

interface GoogleDriveAuthData {
  isAuthenticated: boolean
  userInfo: GoogleUserInfo | null
}

const QUERY_KEY = ['google-drive-auth']

export function useGoogleDriveAuth() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<GoogleDriveAuthData> => {
      const authenticated = await getIsAuthenticated()
      if (!authenticated) {
        return { isAuthenticated: false, userInfo: null }
      }
      const accessToken = await getValidAccessToken()
      const userInfo = await getGoogleUserInfo(accessToken)
      return { isAuthenticated: true, userInfo }
    },
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    [queryClient],
  )

  // Auto-invalidate when token changes in storage
  useEffect(() => {
    return storage.watch(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`, () => {
      void invalidate()
    })
  }, [invalidate])

  return { query, invalidate }
}
