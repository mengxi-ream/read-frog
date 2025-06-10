import { AlertCircle } from 'lucide-react'
import { use } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { ShadowWrapperContext } from '@/utils/react-shadow-host/create-shadow-host'

export function ErrorButton({ error }: { error: Error }) {
  const shadowWrapper = use(ShadowWrapperContext)

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <AlertCircle className="size-3.5 text-red-500 hover:text-red-600 dark:hover:text-red-500" />
      </HoverCardTrigger>
      <HoverCardContent className="w-64" container={shadowWrapper} asChild>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Translation Error</AlertTitle>
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
      </HoverCardContent>
    </HoverCard>
  )
}
