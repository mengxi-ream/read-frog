import type { TTSVoice, TTSVoiceGroup, TTSVoiceItem } from "@/types/config/tts"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/base-ui/combobox"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/base-ui/item"
import { EDGE_TTS_VOICE_GROUPS, getEdgeTTSVoiceItem } from "@/types/config/tts"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

function getTTSVoiceGenderBadgeClass(gender: TTSVoiceItem["gender"]): string | undefined {
  if (gender.startsWith("Male")) {
    return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
  }

  if (gender.startsWith("Female")) {
    return "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
  }

  if (gender === "Neutral") {
    return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
  }

  return undefined
}

function TTSVoiceSelectValue({ voice }: { voice: TTSVoice }) {
  return <span className="block max-w-full min-w-0 truncate">{voice}</span>
}

function getTTSVoiceSearchValue(item: TTSVoiceItem): string {
  return `${item.voice} ${item.language} ${item.type} ${item.gender}`
}

function filterTTSVoiceItem(item: TTSVoiceItem, query: string): boolean {
  return getTTSVoiceSearchValue(item).toLowerCase().includes(query.toLowerCase())
}

function TTSVoiceComboboxItem({ item }: { item: TTSVoiceItem }) {
  return (
    <ComboboxItem key={item.voice} value={item} className="overflow-hidden py-1.5">
      {/* Capped by the row it sits in, not by the anchor: the list can now be wider than the
          trigger, and a name should use every pixel of it before it truncates. */}
      <Item size="sm" className="w-full max-w-full min-w-0 flex-nowrap gap-2 overflow-hidden p-0">
        <ItemContent className="min-w-0 gap-1 overflow-hidden">
          <ItemTitle className="w-full max-w-full min-w-0 overflow-hidden font-mono text-xs">
            <span className="block min-w-0 truncate">{item.voice}</span>
          </ItemTitle>
          <ItemDescription className="m-0 flex max-w-full min-w-0 flex-wrap items-center gap-1.5 overflow-hidden">
            <Badge variant="secondary" size="sm">
              {item.type}
            </Badge>
            <Badge
              variant="secondary"
              size="sm"
              className={getTTSVoiceGenderBadgeClass(item.gender)}
            >
              {item.gender}
            </Badge>
          </ItemDescription>
        </ItemContent>
      </Item>
    </ComboboxItem>
  )
}

function TTSVoiceComboboxGroup({ group }: { group: TTSVoiceGroup }) {
  return (
    <ComboboxGroup
      key={group.language}
      items={group.items}
      className="[&:last-child_[data-slot=combobox-separator]]:hidden"
    >
      <ComboboxLabel className="max-w-full truncate">{group.language}</ComboboxLabel>
      <ComboboxCollection>
        {(item: TTSVoiceItem) => <TTSVoiceComboboxItem key={item.voice} item={item} />}
      </ComboboxCollection>
      <ComboboxSeparator />
    </ComboboxGroup>
  )
}

interface TTSVoiceComboboxProps {
  value: TTSVoice
  onValueChange: (voice: TTSVoice) => void
  /** The trigger fills its column by default; callers size it from the row it sits in. */
  className?: string
  "aria-label"?: string
}

/** Every Edge voice, grouped by the language it speaks. Shared by both rows that pick one. */
export function TTSVoiceCombobox({
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: TTSVoiceComboboxProps) {
  const selectedItem = getEdgeTTSVoiceItem(value)
  const placeholder = i18n.t("options.tts.voice.selectPlaceholder")

  return (
    <Combobox
      value={selectedItem}
      onValueChange={(item: TTSVoiceItem | null) => {
        if (!item) {
          return
        }
        onValueChange(item.voice)
      }}
      items={EDGE_TTS_VOICE_GROUPS}
      filter={filterTTSVoiceItem}
      itemToStringLabel={(item) => item?.voice ?? ""}
      itemToStringValue={(item) => item?.voice ?? ""}
      isItemEqualToValue={(item, selectedValue) =>
        !!item && !!selectedValue && item.voice === selectedValue.voice
      }
      autoHighlight
    >
      <ComboboxTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={ariaLabel}
            // A sm button shrinks its text; a select's sm only shortens the box. Follow the
            // select, so a trigger reads the same whichever control it opens.
            className={cn("w-full min-w-0 justify-between text-sm font-normal", className)}
          />
        }
      >
        <ComboboxValue placeholder={placeholder}>
          {(item: TTSVoiceItem | null) => <TTSVoiceSelectValue voice={item?.voice ?? value} />}
        </ComboboxValue>
      </ComboboxTrigger>
      {/* Follows the trigger, but never below 18rem — a short name like en-US-AmberNeural would
          otherwise anchor the list too narrow to read the long names under it. */}
      <ComboboxContent className="max-h-80 !min-w-[max(var(--anchor-width),18rem)]" align="end">
        <ComboboxInput showTrigger={false} placeholder={placeholder} />
        <ComboboxList>
          {(group: TTSVoiceGroup) => <TTSVoiceComboboxGroup key={group.language} group={group} />}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t("options.tts.voice.noVoicesFound")}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
