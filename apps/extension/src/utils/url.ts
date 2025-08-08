import { WEBSITE_DEV_URL, WEBSITE_PROD_URL } from '@repo/constants'

export function getBaseUrl() {
  return import.meta.env.DEV ? WEBSITE_DEV_URL : WEBSITE_PROD_URL
}
