import { auth } from '@repo/auth'
import { headers } from 'next/headers'

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return <pre>{session?.user.email}</pre>
}
