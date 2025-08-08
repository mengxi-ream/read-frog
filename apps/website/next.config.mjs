import { fileURLToPath } from 'node:url'
import { createMDX } from 'fumadocs-mdx/next'
import createJiti from 'jiti'
import createNextIntlPlugin from 'next-intl/plugin'

const jiti = createJiti(fileURLToPath(import.meta.url))
// Import env here to validate during build. Using jiti@^1 we can import .ts files :)
jiti('./src/env')

// import './src/env.js'

const withMDX = createMDX()
const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    // Set longer cache TTL to reduce transformations and cache writes
    minimumCacheTTL: 60 * 60,

    // Use only WebP format to reduce number of transformations
    formats: ['image/webp'],

    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],

    // Other possible configurations:
    // formats: ['image/avif', 'image/webp'], // Default: supports two modern formats, but increases cache
    // formats: ['image/avif'],               // Only use AVIF: smallest file, but browser support is limited
    // formats: [],                           // No conversion: best compatibility but largest file

    // Optimized device sizes based on common breakpoints (reduced from 6 to 4)
    deviceSizes: [750, 1080, 1200, 1920],

    // Optimized image sizes based on actual usage (reduced from 8 to 3)
    // 实际使用: width={20,24,28,32} 都会选择 32
    // 保留 64 用于可能的较大图标，128 用于头像类图片
    imageSizes: [32, 64, 128, 256, 384],
  },
}

export default withNextIntl(withMDX(config))
