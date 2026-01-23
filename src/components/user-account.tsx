import guest from '@/assets/icons/avatars/guest.svg'
import { Button } from '@/components/base-ui/button'
import { authClient } from '@/utils/auth/auth-client'
import { WEBSITE_URL } from '@/utils/constants/url'
import { cn } from '@/utils/styles/utils'

export function UserAccount() {
  const { data, isPending } = authClient.useSession()
  return (
    <div className="flex items-center gap-2">
      <img
        src={data?.user.image ?? guest}
        alt="User"
        className={cn('rounded-full border size-6', !data?.user.image && 'p-1', isPending && 'animate-pulse')}
      />
      {isPending ? 'Loading...' : data?.user.name ?? 'Guest'}
      {!isPending && !data && (
        <Button
          size="sm"
          variant="outline"
          className="h-5 rounded-sm"
          onClick={() =>
            window.open(`${WEBSITE_URL}/log-in`, '_blank')}
        >
          Log in
        </Button>
      )}
    </div>
  )
}
