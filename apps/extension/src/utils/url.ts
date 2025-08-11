import { WEBSITE_DEV_URL, WEBSITE_PROD_URL } from '@repo/definitions'

export function getBaseUrl() {
  return import.meta.env.DEV ? WEBSITE_DEV_URL : WEBSITE_PROD_URL
}
