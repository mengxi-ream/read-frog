import type Glossary from "@/utils/db/dexie/tables/glossary"
import { IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { useNavigate } from "react-router"
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
import { ConfigItem } from "../../../../components/config-item"
import { useDeleteGlossary, useGlossaryTerms } from "../use-glossary"

/**
 * Deletes the glossary and everything in it, behind a confirm dialog naming the
 * term count — the one fact that tells the user whether this is the list they
 * meant. Last block on the page, right after the export that is the way out.
 */
export function GlossaryDeleteItem({ glossary }: { glossary: Glossary }) {
  const navigate = useNavigate()
  const { data: terms = [] } = useGlossaryTerms(glossary.id)
  const { mutateAsync: deleteGlossary, isPending } = useDeleteGlossary()
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    try {
      await deleteGlossary(glossary.id)
      // `replace`, so Back does not return to an editor whose glossary is gone.
      await navigate("/advanced/glossary", { replace: true })
    } finally {
      setOpen(false)
    }
  }

  return (
    <ConfigItem
      id="glossary-delete"
      title={i18n.t("options.advanced.glossary.editor.delete.title")}
      description={i18n.t("options.advanced.glossary.editor.delete.description")}
    >
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" disabled={isPending} />}
        >
          <IconTrash className="size-4" />
          {i18n.t("options.advanced.glossary.editor.delete.dialog.trigger")}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {i18n.t("options.advanced.glossary.editor.delete.dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t("options.advanced.glossary.editor.delete.dialog.description", [
                String(terms.length),
              ])}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {i18n.t("options.advanced.glossary.editor.delete.dialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isPending}
            >
              {i18n.t("options.advanced.glossary.editor.delete.dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigItem>
  )
}
