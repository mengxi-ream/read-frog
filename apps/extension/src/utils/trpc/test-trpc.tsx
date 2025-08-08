import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpc } from '@/utils/trpc/client'

// TODO: remove this and the place where it is used

export function TestTRPC() {
  const [helloText, setHelloText] = useState('world')
  const [createName, setCreateName] = useState('')
  const queryClient = useQueryClient()

  // Test public procedure - hello query
  const helloQuery = useQuery(trpc.test.hello.queryOptions({ text: helloText }))

  // Test protected procedure - get items query
  const getQuery = useQuery(trpc.test.get.queryOptions())

  // Test protected procedure - create mutation
  const createMutation = useMutation({
    ...trpc.test.create.mutationOptions(),
    onSuccess: () => {
      toast.success('Item created successfully!')
      setCreateName('')
      // Invalidate and refetch the get query
      queryClient.invalidateQueries(trpc.test.get.queryOptions())
    },
    onError: (error) => {
      toast.error(`Failed to create item: ${error.message}`)
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) {
      toast.error('Name is required')
      return
    }
    createMutation.mutate({ name: createName })
  }

  const handleRefreshItems = () => {
    queryClient.invalidateQueries(trpc.test.get.queryOptions())
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-semibold text-foreground">tRPC Test Interface</h2>

      {/* Test Hello Query (Public) */}
      <div className="space-y-3 p-4 border rounded-lg">
        <h3 className="font-medium text-foreground">Test Hello Query (Public)</h3>
        <div className="space-y-2">
          <Label htmlFor="hello-input">Text to greet:</Label>
          <Input
            id="hello-input"
            value={helloText}
            onChange={e => setHelloText(e.target.value)}
            placeholder="Enter text..."
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Status:
            {helloQuery.status}
          </div>
          {helloQuery.isLoading && <div className="text-sm">Loading...</div>}
          {helloQuery.error && (
            <div className="text-sm text-destructive">
              Error:
              {' '}
              {helloQuery.error.message}
            </div>
          )}
          {helloQuery.data && (
            <div className="p-2 bg-secondary rounded text-sm">
              Response:
              {' '}
              {helloQuery.data}
            </div>
          )}
        </div>
      </div>

      {/* Test Get Items Query (Protected) */}
      <div className="space-y-3 p-4 border rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Get Items Query (Protected)</h3>
          <Button
            onClick={handleRefreshItems}
            variant="outline"
            size="sm"
            disabled={getQuery.isLoading}
          >
            Refresh
          </Button>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Status:
            {getQuery.status}
          </div>
          {getQuery.isLoading && <div className="text-sm">Loading...</div>}
          {getQuery.error && (
            <div className="text-sm text-destructive">
              Error:
              {' '}
              {getQuery.error.message}
              {getQuery.error.message.includes('UNAUTHORIZED') && (
                <div className="mt-1 text-xs">
                  This is a protected route. Make sure you're authenticated.
                </div>
              )}
            </div>
          )}
          {getQuery.data && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Items (
                {getQuery.data.length}
                ):
              </div>
              {getQuery.data.length === 0
                ? (
                    <div className="p-2 bg-secondary rounded text-sm text-muted-foreground">
                      No items found
                    </div>
                  )
                : (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {getQuery.data.map(item => (
                        <div key={item.id} className="p-2 bg-secondary rounded text-sm">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ID:
                            {item.id}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          )}
        </div>
      </div>

      {/* Test Create Mutation (Protected) */}
      <div className="space-y-3 p-4 border rounded-lg">
        <h3 className="font-medium text-foreground">Create Item Mutation (Protected)</h3>
        <form onSubmit={handleCreateSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="create-name">Item Name:</Label>
            <Input
              id="create-name"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Enter item name..."
              disabled={createMutation.isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={createMutation.isPending || !createName.trim()}
            className="w-full"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Item'}
          </Button>
        </form>
        {createMutation.error && (
          <div className="text-sm text-destructive">
            Error:
            {' '}
            {createMutation.error.message}
            {createMutation.error.message.includes('UNAUTHORIZED') && (
              <div className="mt-1 text-xs">
                This is a protected route. Make sure you're authenticated.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Debug Information */}
      <details className="space-y-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          Debug Information
        </summary>
        <div className="p-3 bg-muted rounded text-xs space-y-2">
          <div>
            Hello Query Status:
            {helloQuery.status}
          </div>
          <div>
            Get Query Status:
            {getQuery.status}
          </div>
          <div>
            Create Mutation Status:
            {createMutation.status}
          </div>
          <div>
            Create Mutation Pending:
            {String(createMutation.isPending)}
          </div>
        </div>
      </details>
    </div>
  )
}
