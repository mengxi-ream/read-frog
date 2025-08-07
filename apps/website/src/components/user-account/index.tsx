import { auth } from '@repo/auth'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Button } from '../shadcn/button'
import { UserAvatar } from './user-avatar'

export async function UserAccount() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return <LoginButton />
  }

  return (
    <UserAvatar user={session.user} />
  )
}

export function LoginButton() {
  return (
    <Button className="mx-2" asChild>
      <Link href="/log-in">Log in</Link>
    </Button>
  )
}
