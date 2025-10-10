/* eslint-disable react/no-array-index-key */
'use client'

import type { ChangelogEntry } from './parse-changelog'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { parseChangelog } from './parse-changelog'

interface ChangelogContentProps {
  activeTab: 'extension' | 'website'
  extensionChangelog: string
  websiteChangelog: string
}

export function ChangelogContent({
  activeTab,
  extensionChangelog,
  websiteChangelog,
}: ChangelogContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations('changelog')

  const extensionEntries = useMemo(
    () => parseChangelog(extensionChangelog),
    [extensionChangelog],
  )
  const websiteEntries = useMemo(
    () => parseChangelog(websiteChangelog),
    [websiteChangelog],
  )

  const currentEntries
    = activeTab === 'extension' ? extensionEntries : websiteEntries

  const handleTabChange = (tab: 'extension' | 'website') => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mt-8">
      {/* Tabs */}
      <div className="flex border-b border-fd-border mb-8">
        <button
          type="button"
          onClick={() => handleTabChange('extension')}
          className={`px-6 py-3 text-sm font-medium transition-all duration-200 ease relative ${
            activeTab === 'extension'
              ? 'text-fd-foreground'
              : 'text-fd-muted-foreground hover:text-fd-foreground'
          }`}
        >
          {t('extension')}
          {activeTab === 'extension' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-fd-primary transition-all duration-200 ease" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('website')}
          className={`px-6 py-3 text-sm font-medium transition-all duration-200 ease relative ${
            activeTab === 'website'
              ? 'text-fd-foreground'
              : 'text-fd-muted-foreground hover:text-fd-foreground'
          }`}
        >
          {t('website')}
          {activeTab === 'website' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-fd-primary transition-all duration-200 ease" />
          )}
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {currentEntries.map((entry: ChangelogEntry, index: number) => (
          <ChangelogEntryItem
            key={`${entry.version}-${index}`}
            entry={entry}
            isLast={index === currentEntries.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

function ChangelogEntryItem({
  entry,
  isLast,
}: {
  entry: ChangelogEntry
  isLast: boolean
}) {
  const t = useTranslations('changelog')
  return (
    <div className="relative pb-12">
      <div className="flex flex-col md:flex-row gap-y-6">
        {/* Left side - Version */}
        <div className="md:w-48 flex-shrink-0">
          <div className="md:sticky md:top-8 space-y-3">
            {entry.version && (
              <>
                <div className="inline-flex relative z-10 items-center justify-center px-4 py-2 text-fd-foreground border border-fd-border rounded-lg text-sm font-bold bg-fd-background transition-all duration-200 ease">
                  v
                  {entry.version}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right side - Content */}
        <div className="flex-1 md:pl-8 relative">
          {/* Vertical timeline line */}
          {!isLast && (
            <div className="hidden md:block absolute top-2 left-0 w-px h-full bg-fd-border">
              {/* Timeline dot */}
              <div className="hidden md:block absolute -translate-x-1/2 size-3 bg-fd-primary rounded-full z-10" />
            </div>
          )}
          {isLast && (
            <div className="hidden md:block absolute top-2 left-0">
              <div className="hidden md:block -translate-x-1/2 size-3 bg-fd-primary rounded-full z-10" />
            </div>
          )}

          <div className="space-y-6">
            {/* Changes by type */}
            {entry.majorChanges.length > 0 && (
              <ChangeSection
                title={t('majorChanges')}
                changes={entry.majorChanges}
                type="major"
              />
            )}
            {entry.minorChanges.length > 0 && (
              <ChangeSection
                title={t('minorChanges')}
                changes={entry.minorChanges}
                type="minor"
              />
            )}
            {entry.patchChanges.length > 0 && (
              <ChangeSection
                title={t('patchChanges')}
                changes={entry.patchChanges}
                type="patch"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChangeSection({
  title,
  changes,
  type,
}: {
  title: string
  changes: string[]
  type: 'major' | 'minor' | 'patch'
}) {
  const colorClass
    = type === 'major'
      ? 'text-red-600 dark:text-red-400'
      : type === 'minor'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-green-600 dark:text-green-400'

  const borderColorClass
    = type === 'major'
      ? 'border-red-200 dark:border-red-800'
      : type === 'minor'
        ? 'border-blue-200 dark:border-blue-800'
        : 'border-green-200 dark:border-green-800'

  return (
    <div className="group">
      <h3 className={`text-lg font-semibold mb-3 ${colorClass}`}>{title}</h3>
      <ul className="space-y-2">
        {changes.map((change, index) => (
          <li
            key={index}
            className={`text-sm text-fd-muted-foreground leading-relaxed pl-4 border-l-2 ${borderColorClass} transition-all duration-200 ease hover:border-l-4 hover:pl-3`}
          >
            <ChangeText text={change} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Validates that a URL is safe to use in links
 * Only allows HTTP/HTTPS protocols and trusted domains to prevent XSS and open redirect attacks
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }
    // Add allowlist for trusted domains
    const allowedDomains = ['github.com', 'www.github.com', 'readfrog.app', 'www.readfrog.app']
    const hostname = parsed.hostname.toLowerCase()
    return allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
  }
  catch {
    return false
  }
}

// Combined regex pattern for all markdown elements (moved to module scope for performance)
const MARKDOWN_PATTERN = /\[#(\d+)\]\((https?:\/\/[^)]+)\)|\[`([a-f0-9]+)`\]\((https?:\/\/[^)]+)\)|\[@([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g

function ChangeText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  let key = 0
  const matches = text.matchAll(MARKDOWN_PATTERN)

  for (const match of matches) {
    // Add text before match
    if (match.index !== undefined && match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    // Issue link: [#123](url)
    if (match[1] && match[2] && isValidUrl(match[2])) {
      parts.push(
        <a
          key={key++}
          href={match[2]}
          className="text-fd-primary hover:underline transition-all duration-200 ease font-medium"
          target="_blank"
          rel="noopener noreferrer"
        >
          #
          {match[1]}
        </a>,
      )
    }
    // Commit link: [`abc123`](url)
    else if (match[3] && match[4] && isValidUrl(match[4])) {
      parts.push(
        <a
          key={key++}
          href={match[4]}
          className="text-fd-primary hover:underline transition-all duration-200 ease font-mono text-xs"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[3]}
        </a>,
      )
    }
    // User mention: [@user](url)
    else if (match[5] && match[6] && isValidUrl(match[6])) {
      parts.push(
        <a
          key={key++}
          href={match[6]}
          className="text-fd-primary hover:underline transition-all duration-200 ease"
          target="_blank"
          rel="noopener noreferrer"
        >
          @
          {match[5]}
        </a>,
      )
    }
    // Bold: **text**
    else if (match[7]) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {match[7]}
        </strong>,
      )
    }
    // Inline code: `text`
    else if (match[8]) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-fd-muted text-fd-foreground font-mono text-xs border border-fd-border/50"
        >
          {match[8]}
        </code>,
      )
    }

    if (match.index !== undefined) {
      lastIndex = match.index + match[0].length
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return <>{parts}</>
}
