import { WEBSITE_DEV_URL, WEBSITE_PROD_URL } from '@repo/definitions'

export function getBaseUrl() {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  return import.meta.env.DEV ? WEBSITE_DEV_URL : WEBSITE_PROD_URL
}
