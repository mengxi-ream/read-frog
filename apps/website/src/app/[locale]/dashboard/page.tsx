import { auth } from '@repo/auth'
import { headers } from 'next/headers'
import { api } from '@/trpc/server'
import { Test } from './test'

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  const res = await api.test.hello({
    text: 'world',
  })

  return (
    <div>
      <Test />
      <pre>
        {session?.user.email}
        {' '}
        {res}
      </pre>
    </div>
  )
}
