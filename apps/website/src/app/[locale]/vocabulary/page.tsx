'use client'

import type { RouterOutputs } from '@/trpc/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useTRPC } from '@/trpc/react'
import { LANG_CODE_TO_EN_NAME } from '@/types/languages'

export default function VocabularyPage() {
  const trpc = useTRPC()
  const listQuery = useQuery(trpc.vocabulary.list.queryOptions())

  if (listQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">Vocabulary</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (listQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">Vocabulary</h1>
        <div className="space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">{listQuery.error.message}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Not signed in?
            {' '}
            <Link href="/log-in" className="text-blue-600 underline">Log in</Link>
            {' '}
            to view your saved vocabulary.
          </p>
        </div>
      </div>
    )
  }

  const items = (listQuery.data ?? []) as RouterOutputs['vocabulary']['list']

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vocabulary</h1>
        <button
          type="button"
          onClick={() => listQuery.refetch()}
          disabled={listQuery.isFetching}
          className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
        >
          {listQuery.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300">
        <p className="leading-relaxed">
          Beta notice: This feature is currently in beta. Expect significant changes and new capabilities over time. For now, each user can store up to 100 entries, and there is a risk of data loss.
        </p>
      </div>

      {items.length === 0
        ? (
            <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-sm text-gray-600 dark:text-gray-300">
              No vocabulary yet. Save translations from the extension to see them here.
            </div>
          )
        : (
            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Original</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Translation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">From</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">To</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="whitespace-pre-wrap px-4 py-3 align-top text-sm text-gray-900 dark:text-gray-100">{item.originalText}</td>
                      <td className="whitespace-pre-wrap px-4 py-3 align-top text-sm text-gray-900 dark:text-gray-100">{item.translation}</td>
                      <td className="px-4 py-3 align-top text-xs text-gray-600 dark:text-gray-300">
                        {LANG_CODE_TO_EN_NAME[item.sourceLanguageISO6393]}
                        {' '}
                        <span className="text-gray-400 dark:text-gray-500">
                          (
                          {item.sourceLanguageISO6393}
                          )
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-600 dark:text-gray-300">
                        {LANG_CODE_TO_EN_NAME[item.targetLanguageISO6393]}
                        {' '}
                        <span className="text-gray-400 dark:text-gray-500">
                          (
                          {item.targetLanguageISO6393}
                          )
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-500 dark:text-gray-400">{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  )
}
