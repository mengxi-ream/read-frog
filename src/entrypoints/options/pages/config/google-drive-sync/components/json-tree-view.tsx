import type { ItemInstance } from '@headless-tree/core'
import type { Config } from '@/types/config/config'
import { i18n } from '#i18n'
import { syncDataLoaderFeature } from '@headless-tree/core'
import { useTree } from '@headless-tree/react'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { Tree, TreeItem, TreeItemLabel } from '@/components/shadcn/tree'
import { diffResultAtom } from '@/utils/atoms/google-drive-sync'
import { ConflictField } from './conflict-field'
import { formatValue } from './utils'

interface JsonNodeData {
  key: string
  value: unknown
  pathKey: string
  isArrayItem: boolean
}

interface JsonTreeViewProps {
  data: Config
}

function buildTreeData(data: Config): {
  items: Map<string, JsonNodeData>
  children: Map<string, string[]>
} {
  const items = new Map<string, JsonNodeData>()
  const children = new Map<string, string[]>()

  function traverse(value: Config, path: string[]) {
    const pathKey = path.join('.')
    const key = path[path.length - 1] || 'root'
    const itemId = pathKey || 'root'

    items.set(itemId, { key, value, pathKey, isArrayItem: !Number.isNaN(Number(key)) })

    if (value !== null && typeof value === 'object') {
      const entries = Array.isArray(value)
        ? value.map((v, i) => [String(i), v] as const)
        : Object.entries(value)
      children.set(itemId, entries.map(([k]) => [...path, k].join('.')))
      for (const [childKey, childValue] of entries) {
        traverse(childValue, [...path, childKey])
      }
    }
    else {
      children.set(itemId, [])
    }
  }

  traverse(data, [])
  return { items, children }
}

export function JsonTreeView({ data }: JsonTreeViewProps) {
  const diffResult = useAtomValue(diffResultAtom)
  const { items, children } = useMemo(() => buildTreeData(data), [data])

  const conflictPaths = useMemo(() => {
    if (!diffResult)
      return new Set<string>()
    return new Set(diffResult.conflicts.map(c => c.path.join('.')))
  }, [diffResult])

  // Expand all items that have conflicts when the component is mounted
  const initialExpandedItems = useMemo(() => {
    const expanded = new Set<string>(['root'])
    for (const conflictPath of conflictPaths) {
      const parts = conflictPath.split('.')
      for (let i = 1; i <= parts.length; i++) {
        expanded.add(parts.slice(0, i).join('.'))
      }
    }
    return Array.from(expanded)
  }, [conflictPaths])

  const tree = useTree<JsonNodeData>({
    rootItemId: 'root',
    dataLoader: {
      getItem: (itemId: string) => items.get(itemId)!,
      getChildren: (itemId: string) => children.get(itemId) || [],
    },
    isItemFolder: item => (children.get(item.getId()) || []).length > 0,
    getItemName: item => item.getItemData().key,
    initialState: { expandedItems: initialExpandedItems },
    features: [syncDataLoaderFeature],
  })

  const formatFolderLabel = (value: unknown, childrenCount: number): string => {
    const countText = childrenCount === 1
      ? `${childrenCount} ${i18n.t('options.config.sync.googleDrive.conflict.item')}`
      : `${childrenCount} ${i18n.t('options.config.sync.googleDrive.conflict.items')}`

    return Array.isArray(value) ? `[${countText}]` : `{${countText}}`
  }

  const renderItem = (item: ItemInstance<JsonNodeData>): React.ReactNode => {
    const { pathKey, key, value, isArrayItem } = item.getItemData()
    const hasConflict = conflictPaths.has(pathKey)
    const level = item.getItemMeta().level
    const isFolder = item.isFolder()
    const isExpanded = item.isExpanded()

    // Conflict field - interactive selection
    if (hasConflict) {
      return <ConflictField key={pathKey} pathKey={pathKey} indent={level * 20 + 28} />
    }

    return (
      <div key={item.getId()}>
        <TreeItem item={item}>
          <TreeItemLabel className="font-mono text-sm bg-transparent hover:bg-transparent">
            {!isArrayItem && <span className="text-blue-600 dark:text-blue-400">{key}</span>}
            {!isArrayItem && <span className="text-slate-500 mx-1">:</span>}
            <span className="text-slate-700 dark:text-slate-300">
              {isFolder ? formatFolderLabel(value, item.getChildren().length ?? 0) : formatValue(value)}
            </span>
          </TreeItemLabel>
        </TreeItem>
        {isFolder && isExpanded && item.getChildren().map(renderItem)}
      </div>
    )
  }

  return (
    <Tree tree={tree} indent={20} toggleIconType="chevron" className="py-2">
      {tree.getRootItem().getChildren().map(renderItem)}
    </Tree>
  )
}
