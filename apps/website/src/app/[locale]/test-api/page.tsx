'use client'

import { useState } from 'react'
import { client } from '@/orpc/orpc'

export default function ORPCPage() {
  const [input, setInput] = useState('')
  const [echoed, setEchoed] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setEchoed(null)
    try {
      const { echoedMessage } = await client.echoHandler({ message: input })
      setEchoed(echoedMessage)
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <main className="w-full max-w-xs mx-auto flex flex-col items-center">
        <div className="w-full flex justify-center mb-6">
          <span className="font-mono text-xs bg-green-400/10 text-green-300 border border-green-900 rounded px-3 py-1 select-all">
            app/orpc_example
          </span>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="text"
            className="w-full rounded bg-gray-900 border border-green-900 px-3 py-2 text-green-200 placeholder:text-green-400 focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            required
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-green-400 text-gray-900 font-bold rounded py-2 transition hover:bg-green-300 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
        {echoed !== null && (
          <div className="mt-8 w-full text-center">
            <p className="text-green-200 text-base">{echoed}</p>
          </div>
        )}
      </main>
    </div>
  )
}
