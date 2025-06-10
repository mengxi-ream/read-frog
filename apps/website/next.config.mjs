import { createMDX } from 'fumadocs-mdx/next'
import createNextIntlPlugin from 'next-intl/plugin'

const withMDX = createMDX()
const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
}

export default withNextIntl(withMDX(config))
