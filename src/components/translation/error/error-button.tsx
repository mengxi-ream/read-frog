import type { APICallError } from "ai"
import { Icon } from "@iconify/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/base-ui/hover-card"

export function ErrorButton({ error }: { error: APICallError }) {
  return (
    <HoverCard>
      <HoverCardTrigger render={<Icon icon="tabler:alert-circle" className="size-4 text-destructive hover:text-destructive/90 cursor-pointer" />} />
      <HoverCardContent className="w-64 notranslate" render={<Alert />}>
        <Icon icon="tabler:alert-circle" className="size-4 text-red-500!" />
        <AlertTitle>Translation Error</AlertTitle>
        <AlertDescription className="break-all">
          <StatusCode statusCode={error.statusCode ?? 500} />
          <p className="text-zinc-900 dark:text-zinc-100">{error.message || "Something went wrong"}</p>
        </AlertDescription>
      </HoverCardContent>
    </HoverCard>
  )
}

function StatusCode({ statusCode }: { statusCode: number }) {
  const getStatusCodeColor = (code: number) => {
    const firstDigit = Math.floor(code / 100)
    switch (firstDigit) {
      case 2: return "bg-green-500" // 2xx - Success
      case 3: return "bg-blue-500" // 3xx - Redirection
      case 4: return "bg-yellow-500" // 4xx - Client Error
      case 5: return "bg-red-500" // 5xx - Server Error
      default: return "bg-gray-500" // Unknown
    }
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-2 h-2 rounded-full ${getStatusCodeColor(statusCode)}`} />
      <span className="text-sm font-medium">
        Status Code:
        {statusCode}
      </span>
    </div>
  )
}
