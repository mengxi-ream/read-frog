import { LOCALHOST_DOMAIN, READFROG_DOMAIN, WEBSITE_DEV_URL, WEBSITE_PROD_URL } from "@read-frog/definitions"

export const OFFICIAL_SITE_URL_PATTERNS = [
  `https://*.${READFROG_DOMAIN}/*`,
  `http://${LOCALHOST_DOMAIN}/*`,
]

export const WEBSITE_URL = (import.meta.env.DEV && import.meta.env.WXT_USE_LOCAL_PACKAGES === "true")
  ? WEBSITE_DEV_URL
  : WEBSITE_PROD_URL
