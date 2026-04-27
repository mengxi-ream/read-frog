import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"

export function CopyResultButton({ text }: { text: string }) {
  const [isCopying, setIsCopying] = useState(false)

  const handleCopy = async () => {
    setIsCopying(true)
    try {
      await navigator.clipboard.writeText(text)
      toast.success(i18n.t("splitTranslator.copied"))
    }
    catch {
      toast.error(i18n.t("splitTranslator.copyFailed"))
    }
    finally {
      setIsCopying(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      disabled={isCopying}
      aria-label={i18n.t("splitTranslator.copyResult")}
    >
      <Icon icon="tabler:copy" className="size-4" />
      {i18n.t("splitTranslator.copyResult")}
    </Button>
  )
}
