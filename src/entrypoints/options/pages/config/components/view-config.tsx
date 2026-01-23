import type { ButtonProps } from '@/components/base-ui/button'
import type { Config } from '@/types/config/config'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Button } from '@/components/base-ui/button'
import { ScrollArea } from '@/components/shadcn/scroll-area'
import { CONFIG_SCHEMA_VERSION } from '@/utils/constants/config'

export function ViewConfig({ config, configSchemaVersion, size = 'default' }: { config: Config, configSchemaVersion?: number, size?: ButtonProps['size'] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="w-full flex flex-col justify-end">
      <Button
        variant="outline"
        size={size}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Icon
          icon={isExpanded ? 'tabler:chevron-up' : 'tabler:chevron-down'}
        />
        {isExpanded ? i18n.t('options.config.sync.viewConfig.collapse') : i18n.t('options.config.sync.viewConfig.expand')}
      </Button>

      {isExpanded && (
        <ScrollArea className="h-96 w-full rounded-lg border bg-muted mt-3">
          <pre className="text-xs p-4 whitespace-pre-wrap break-all overflow-wrap-anywhere">
            {JSON.stringify({
              schemaVersion: configSchemaVersion ?? CONFIG_SCHEMA_VERSION,
              config,
            }, null, 2)}
          </pre>
        </ScrollArea>
      )}
    </div>
  )
}
