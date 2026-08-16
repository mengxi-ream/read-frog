import { useAtom } from "jotai"
import { Input } from "@/components/ui/base-ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import {
  MINIMAX_SPEECH_MODELS,
  MINIMAX_TTS_AUDIO_FORMATS,
  MINIMAX_TTS_REGIONS,
} from "@/types/minimax-tts"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_MINIMAX_TTS_CONFIG } from "@/utils/constants/tts"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

export function TTSBackendSection() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const backend = ttsConfig.backend ?? "edge"
  const minimax = ttsConfig.minimax ?? DEFAULT_MINIMAX_TTS_CONFIG

  const updateMiniMax = (patch: Partial<typeof minimax>) => {
    void setTtsConfig({
      minimax: {
        ...minimax,
        ...patch,
      },
    })
  }

  return (
    <ConfigSection id="tts-backend" title={i18n.t("options.tts.backend.title")}>
      <ConfigItem
        id="tts-provider"
        title={i18n.t("options.tts.backend.provider.title")}
        description={i18n.t("options.tts.backend.provider.description")}
      >
        <Select
          value={backend}
          onValueChange={(value) => {
            if (value === "edge" || value === "minimax") {
              void setTtsConfig({ backend: value })
            }
          }}
        >
          <SelectTrigger className="w-64 max-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="edge">Edge TTS</SelectItem>
              <SelectItem value="minimax">MiniMax</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </ConfigItem>

      {backend === "minimax" && (
        <>
          <ConfigItem
            id="minimax-tts-region"
            title={i18n.t("options.tts.backend.region.title")}
            description={i18n.t("options.tts.backend.region.description")}
          >
            <Select
              value={minimax.region}
              onValueChange={(region) => {
                if (region && MINIMAX_TTS_REGIONS.includes(region)) {
                  updateMiniMax({ region })
                }
              }}
            >
              <SelectTrigger className="w-64 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="global">
                    {i18n.t("options.tts.backend.region.global")}
                  </SelectItem>
                  <SelectItem value="china">
                    {i18n.t("options.tts.backend.region.china")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </ConfigItem>
          <ConfigItem
            id="minimax-tts-model"
            title={i18n.t("options.tts.backend.model.title")}
            description={i18n.t("options.tts.backend.model.description")}
          >
            <Select
              value={minimax.model}
              onValueChange={(model) => {
                if (model && MINIMAX_SPEECH_MODELS.includes(model)) {
                  updateMiniMax({ model })
                }
              }}
            >
              <SelectTrigger className="w-64 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MINIMAX_SPEECH_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </ConfigItem>
          <ConfigItem
            id="minimax-tts-voice"
            title={i18n.t("options.tts.backend.voice.title")}
            description={i18n.t("options.tts.backend.voice.description")}
          >
            <Input
              className="w-64 max-w-full"
              value={minimax.voiceId}
              placeholder={i18n.t("options.tts.backend.voice.placeholder")}
              onChange={(event) => updateMiniMax({ voiceId: event.target.value })}
            />
          </ConfigItem>
          <ConfigItem
            id="minimax-tts-format"
            title={i18n.t("options.tts.backend.format.title")}
            description={i18n.t("options.tts.backend.format.description")}
          >
            <Select
              value={minimax.audioFormat}
              onValueChange={(audioFormat) => {
                if (audioFormat && MINIMAX_TTS_AUDIO_FORMATS.includes(audioFormat)) {
                  updateMiniMax({ audioFormat })
                }
              }}
            >
              <SelectTrigger className="w-40 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MINIMAX_TTS_AUDIO_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </ConfigItem>
        </>
      )}
    </ConfigSection>
  )
}
