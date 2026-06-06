import type { KnowledgeBaseSurface } from "@/types/knowledge-base"
import { Icon } from "@iconify/react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { saveAs } from "file-saver"
import { useAtom } from "jotai"
import { toast } from "sonner"
import { i18n } from "#imports"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import { Input } from "@/components/ui/base-ui/input"
import { Label } from "@/components/ui/base-ui/label"
import { Switch } from "@/components/ui/base-ui/switch"
import { KNOWLEDGE_BASE_SURFACES } from "@/types/knowledge-base"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { sendMessage } from "@/utils/message"
import { queryClient } from "@/utils/tanstack-query"
import { ConfigCard } from "../../components/config-card"
import { PageLayout } from "../../components/page-layout"

type KnowledgeBaseI18nKey =
  | "title"
  | "toggle.title"
  | "toggle.description"
  | "surfaces.title"
  | "surfaces.description"
  | `surfaces.${KnowledgeBaseSurface}`
  | "remote.title"
  | "remote.description"
  | "remote.enabled"
  | "remote.endpoint"
  | "remote.token"
  | "remote.test"
  | "remote.testSuccess"
  | "remote.testFailed"
  | "data.title"
  | "data.description"
  | "data.items"
  | "data.events"
  | "data.queue"
  | "data.exportJsonl"
  | "data.exportJson"
  | "data.exportSuccess"
  | "data.clear"
  | "data.clearSuccess"
  | "data.clearDialogTitle"
  | "data.clearDialogDescription"
  | "data.cancel"
  | "data.confirmClear"

function t(key: KnowledgeBaseI18nKey) {
  return i18n.t(`options.knowledgeBase.${key}` as any)
}

const SURFACE_ICON: Record<KnowledgeBaseSurface, string> = {
  page: "tabler:file-text",
  node: "tabler:cursor-text",
  selection: "tabler:select",
  input: "tabler:keyboard",
  subtitles: "tabler:subtitles",
  translationHub: "tabler:language",
}

export function KnowledgeBasePage() {
  return (
    <PageLayout title={t("title")} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <KnowledgeBaseToggle />
      <CaptureSurfaces />
      <RemoteSyncConfig />
      <KnowledgeBaseData />
    </PageLayout>
  )
}

function KnowledgeBaseToggle() {
  const [knowledgeBase, setKnowledgeBase] = useAtom(configFieldsAtomMap.knowledgeBase)

  return (
    <ConfigCard
      id="knowledge-base-toggle"
      title={t("toggle.title")}
      description={t("toggle.description")}
    >
      <div className="flex justify-end">
        <Switch
          checked={knowledgeBase.enabled}
          onCheckedChange={(enabled) => {
            void setKnowledgeBase({ ...knowledgeBase, enabled })
          }}
        />
      </div>
    </ConfigCard>
  )
}

function CaptureSurfaces() {
  const [knowledgeBase, setKnowledgeBase] = useAtom(configFieldsAtomMap.knowledgeBase)

  const toggleSurface = (surface: KnowledgeBaseSurface, checked: boolean) => {
    const captureSurfaces = checked
      ? Array.from(new Set([...knowledgeBase.captureSurfaces, surface]))
      : knowledgeBase.captureSurfaces.filter(item => item !== surface)

    void setKnowledgeBase({
      ...knowledgeBase,
      captureSurfaces,
    })
  }

  return (
    <ConfigCard
      id="knowledge-base-surfaces"
      title={t("surfaces.title")}
      description={t("surfaces.description")}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {KNOWLEDGE_BASE_SURFACES.map(surface => (
          <label
            key={surface}
            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent/50"
          >
            <Checkbox
              checked={knowledgeBase.captureSurfaces.includes(surface)}
              onCheckedChange={checked => toggleSurface(surface, checked)}
            />
            <Icon icon={SURFACE_ICON[surface]} className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">{t(`surfaces.${surface}`)}</span>
          </label>
        ))}
      </div>
    </ConfigCard>
  )
}

function RemoteSyncConfig() {
  const [knowledgeBase, setKnowledgeBase] = useAtom(configFieldsAtomMap.knowledgeBase)
  const remoteSync = knowledgeBase.remoteSync

  const testMutation = useMutation({
    mutationFn: async () => await sendMessage("testKnowledgeBaseSync", {
      endpoint: remoteSync.endpoint,
      token: remoteSync.token,
    }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(t("remote.testSuccess"))
      }
      else {
        toast.error(result.message ?? t("remote.testFailed"))
      }
    },
  })

  const updateRemoteSync = (patch: Partial<typeof remoteSync>) => {
    void setKnowledgeBase({
      ...knowledgeBase,
      remoteSync: {
        ...remoteSync,
        ...patch,
      },
    })
  }

  return (
    <ConfigCard
      id="knowledge-base-remote-sync"
      title={t("remote.title")}
      description={t("remote.description")}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="knowledge-base-remote-enabled" className="text-sm font-medium">
            {t("remote.enabled")}
          </Label>
          <Switch
            id="knowledge-base-remote-enabled"
            checked={remoteSync.enabled}
            onCheckedChange={enabled => updateRemoteSync({ enabled })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="knowledge-base-endpoint" className="text-sm font-medium">
            {t("remote.endpoint")}
          </Label>
          <Input
            id="knowledge-base-endpoint"
            value={remoteSync.endpoint}
            placeholder="https://example.com/api/readfrog-memory"
            onChange={event => updateRemoteSync({ endpoint: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="knowledge-base-token" className="text-sm font-medium">
            {t("remote.token")}
          </Label>
          <Input
            id="knowledge-base-token"
            type="password"
            value={remoteSync.token}
            placeholder="Bearer token"
            onChange={event => updateRemoteSync({ token: event.target.value })}
          />
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={!remoteSync.endpoint.trim() || testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            <Icon icon={testMutation.isPending ? "tabler:loader-2" : "tabler:plug-connected"} className={testMutation.isPending ? "animate-spin" : ""} />
            {t("remote.test")}
          </Button>
        </div>
      </div>
    </ConfigCard>
  )
}

function KnowledgeBaseData() {
  const { data: stats, isPending } = useQuery({
    queryKey: ["translation-memory-stats"],
    queryFn: async () => await sendMessage("getTranslationMemoryStats"),
  })

  const exportMutation = useMutation({
    mutationFn: async (format: "jsonl" | "json") => {
      const content = await sendMessage("exportTranslationMemory", { format })
      const extension = format === "json" ? "json" : "jsonl"
      const blob = new Blob([content], { type: format === "json" ? "application/json;charset=utf-8" : "application/x-ndjson;charset=utf-8" })
      saveAs(blob, `read-frog-translation-memory.${extension}`)
    },
    onSuccess: () => {
      toast.success(t("data.exportSuccess"))
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => sendMessage("clearTranslationMemory"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["translation-memory-stats"] })
      toast.success(t("data.clearSuccess"))
    },
  })

  return (
    <ConfigCard
      id="knowledge-base-data"
      title={t("data.title")}
      description={t("data.description")}
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label={t("data.items")} value={isPending ? "..." : String(stats?.itemCount ?? 0)} />
          <Metric label={t("data.events")} value={isPending ? "..." : String(stats?.eventCount ?? 0)} />
          <Metric label={t("data.queue")} value={isPending ? "..." : String(stats?.queuedSyncCount ?? 0)} />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate("jsonl")}
          >
            <Icon icon="tabler:file-type-json" />
            {t("data.exportJsonl")}
          </Button>
          <Button
            variant="outline"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate("json")}
          >
            <Icon icon="tabler:braces" />
            {t("data.exportJson")}
          </Button>
          <ClearKnowledgeBaseButton
            disabled={clearMutation.isPending}
            onConfirm={() => clearMutation.mutate()}
          />
        </div>
      </div>
    </ConfigCard>
  )
}

function Metric({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function ClearKnowledgeBaseButton({ disabled, onConfirm }: { disabled: boolean, onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" disabled={disabled} />}>
        <Icon icon="tabler:trash" />
        {t("data.clear")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("data.clearDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("data.clearDialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("data.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t("data.confirmClear")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
