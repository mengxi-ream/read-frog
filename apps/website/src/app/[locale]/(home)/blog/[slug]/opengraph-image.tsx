import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { notFound } from 'next/navigation'
import { ImageResponse } from 'next/og'
import { blog } from '@/lib/source'

export const alt = 'Read Frog Blog Post'
export const size = {
  width: 1200,
  height: 630,
}

export default async function Image(props: {
  params: Promise<{ slug: string, locale: string }>
}) {
  const params = await props.params
  const page = blog.getPage([params.slug], params.locale)

  if (!page)
    notFound()

  // Load logo
  const logoData = await readFile(join(process.cwd(), 'public/logo.png'), 'base64')
  const logoSrc = `data:image/png;base64,${logoData}`

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'black',
          backgroundImage: [
            'linear-gradient(140deg, hsla(274,94%,54%,0.3), transparent 50%)',
            'linear-gradient(to left top, hsla(260,90%,50%,0.8), transparent 50%)',
            'radial-gradient(circle at 100% 100%, hsla(240,100%,82%,1), hsla(240,40%,40%,1) 17%, hsla(240,40%,40%,0.5) 20%, transparent)',
          ].join(', '),
          backgroundBlendMode: 'difference, difference, normal',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo and branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '40px',
          }}
        >
          <img
            src={logoSrc}
            alt="Read Frog Logo"
            width={60}
            height={60}
            style={{
              borderRadius: '12px',
            }}
          />
          <div
            style={{
              fontSize: 32,
              fontWeight: '600',
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            Read Frog
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 64,
              fontWeight: '700',
              color: 'white',
              lineHeight: 1.2,
              margin: 0,
              marginBottom: '24px',
              maxWidth: '90%',
              letterSpacing: '-0.03em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {page.data.title}
          </h1>

          {page.data.description && (
            <p
              style={{
                fontSize: 28,
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: 1.4,
                margin: 0,
                marginBottom: '32px',
                maxWidth: '85%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {page.data.description}
            </p>
          )}
        </div>

        {/* Footer meta */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            fontSize: 22,
            color: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>By</span>
            <span style={{ fontWeight: '600', color: 'white' }}>
              {page.data.author}
            </span>
          </div>
          <div
            style={{
              width: '4px',
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '50%',
            }}
          />
          <div>
            {new Date(page.data.date ?? page.path).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
