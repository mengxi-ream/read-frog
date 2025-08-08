import { WEBSITE_DEV_URL, WEBSITE_PROD_URL } from '@repo/constants'

export const OFFICIAL_SITE_URL_PATTERNS = [
  'https://*.readfrog.app/*',
  'http://localhost/*',
]

export const WEBSITE_URL = import.meta.env.DEV ? WEBSITE_DEV_URL : WEBSITE_PROD_URL
