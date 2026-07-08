import type { VariantProps } from "class-variance-authority"
import type { buttonVariants } from "@/components/ui/base-ui/button"
import type { Config } from "@/types/config/config"
import { Icon } from "@iconify/react"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { ScrollArea } from "@/components/ui/base-ui/scroll-area"
import { CONFIG_SCHEMA_VERSION } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"

export function ViewConfig({
  config,
  configSchemaVersion,
  size = "default",
}: {
  config: Config
  configSchemaVersion?: number
  size?: VariantProps<typeof buttonVariants>["size"]
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="flex w-full flex-col justify-end">
      <Button variant="outline" size={size} onClick={() => setIsExpanded(!isExpanded)}>
        <Icon icon={isExpanded ? "tabler:chevron-up" : "tabler:chevron-down"} />
        {isExpanded
          ? i18n.t("options.config.sync.viewConfig.collapse")
          : i18n.t("options.config.sync.viewConfig.expand")}
      </Button>

      {isExpanded && (
        <ScrollArea className="mt-3 h-96 w-full rounded-lg border bg-muted">
          <pre className="overflow-wrap-anywhere p-4 text-xs break-all whitespace-pre-wrap">
            {JSON.stringify(
              {
                schemaVersion: configSchemaVersion ?? CONFIG_SCHEMA_VERSION,
                config,
              },
              null,
              2,
            )}
          </pre>
        </ScrollArea>
      )}
    </div>
  )
}
