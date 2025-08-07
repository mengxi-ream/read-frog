'use client'

import { useState } from 'react'
import { Button } from '@/components/shadcn/button'
import { cn } from '@/lib/cn'
import { api } from '@/trpc/react'

export function Test() {
  const [helloText, setHelloText] = useState('')
  const [newItemName, setNewItemName] = useState('')

  // Query for hello endpoint
  const helloQuery = api.test.hello.useQuery(
    { text: helloText },
    {
      enabled: helloText.length > 0,
      refetchOnWindowFocus: false,
    },
  )

  // Query for getting all test items
  const testItemsQuery = api.test.get.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })

  // Mutation for creating new test items
  const createItemMutation = api.test.create.useMutation({
    onSuccess: () => {
      // Refetch the items list after successful creation
      testItemsQuery.refetch()
      setNewItemName('')
    },
    onError: (error) => {
      console.error('Failed to create item:', error)
    },
  })

  const handleCreateItem = () => {
    if (newItemName.trim()) {
      createItemMutation.mutate({ name: newItemName.trim() })
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Test tRPC Router
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Testing all procedures from the test router
        </p>
      </div>

      {/* Hello Query Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Hello Query Test
        </h2>
        <div className="space-y-3">
          <Input
            type="text"
            placeholder="Enter text for hello query..."
            value={helloText}
            onChange={e => setHelloText(e.target.value)}
            className="w-full"
          />
          {helloQuery.data && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-green-800 dark:text-green-200 font-medium">
                Response:
                {' '}
                {helloQuery.data}
              </p>
            </div>
          )}
          {helloQuery.isLoading && (
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          )}
        </div>
      </div>

      {/* Create Item Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Create New Item
        </h2>
        <div className="flex gap-3">
          <Input
            type="text"
            placeholder="Enter item name..."
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateItem()
              }
            }}
          />
          <Button
            onClick={handleCreateItem}
            disabled={!newItemName.trim() || createItemMutation.isPending}
            className="px-6"
          >
            {createItemMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
        {createItemMutation.isError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200 text-sm">
              Error:
              {' '}
              {createItemMutation.error?.message || 'Failed to create item'}
            </p>
          </div>
        )}
        {createItemMutation.isSuccess && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-green-800 dark:text-green-200 text-sm">
              ✅ Item created successfully!
            </p>
          </div>
        )}
      </div>

      {/* Items List Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Test Items List
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => testItemsQuery.refetch()}
            disabled={testItemsQuery.isFetching}
          >
            {testItemsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {testItemsQuery.isLoading && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Loading items...</p>
          </div>
        )}

        {testItemsQuery.isError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200 text-sm">
              Error loading items:
              {' '}
              {testItemsQuery.error?.message}
            </p>
          </div>
        )}

        {testItemsQuery.data && (
          <div className="space-y-2">
            {testItemsQuery.data.length === 0
              ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      No items found. Create your first item above!
                    </p>
                  </div>
                )
              : (
                  testItemsQuery.data.map(item => (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md border"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          ID:
                          {' '}
                          {item.id}
                        </span>
                      </div>
                    </div>
                  ))
                )}
            {testItemsQuery.data.length > 0 && (
              <div className="text-center pt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total items:
                  {' '}
                  {testItemsQuery.data.length}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}
