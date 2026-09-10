import { IconTrash } from "@tabler/icons-react"
import { useState } from "react"
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
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { useDeleteAllGlossaryTerms, useGlossaryTerms } from "./use-glossary"

/**
 * Last block on the page, and behind a confirm dialog, because unlike every
 * other destructive action in these settings this one does not delete a cache
 * that regenerates — it deletes text the user typed. Export sits directly above
 * it so the way out is the thing they just scrolled past.
 */
export function GlossaryDeleteAllItem({ glossaryId }: { glossaryId: string }) {
  const { data: terms = [] } = useGlossaryTerms(glossaryId)
  const { mutateAsync: deleteAll, isPending } = useDeleteAllGlossaryTerms(glossaryId)
  const [open, setOpen] = useState(false)

  const handleDeleteAll = async () => {
    try {
      await deleteAll()
    } finally {
      setOpen(false)
    }
  }

  return (
    <ConfigItem
      id="glossary-delete-all"
      title={i18n.t("options.advanced.glossary.deleteAll.title")}
      description={i18n.t("options.advanced.glossary.deleteAll.description")}
    >
      <AlertDialog open={open} onOpenChange={setOpen}>
        {/* Nothing to delete is a disabled button rather than a hidden one: the
            block keeps its place on the page so the layout does not shift when
            the first term is added. */}
        <AlertDialogTrigger
          render={
            <Button variant="destructive" size="sm" disabled={isPending || terms.length === 0} />
          }
        >
          <IconTrash className="size-4" />
          {i18n.t("options.advanced.glossary.deleteAll.dialog.trigger")}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {i18n.t("options.advanced.glossary.deleteAll.dialog.title")}
            </AlertDialogTitle>
            {/* The count is in the confirm text because it is the one fact that
                tells the user whether this is the list they meant. */}
            <AlertDialogDescription>
              {i18n.t("options.advanced.glossary.deleteAll.dialog.description", [
                String(terms.length),
              ])}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {i18n.t("options.advanced.glossary.deleteAll.dialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleDeleteAll()}
              disabled={isPending}
            >
              {isPending
                ? i18n.t("options.advanced.glossary.deleteAll.deleting")
                : i18n.t("options.advanced.glossary.deleteAll.dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigItem>
  )
}
