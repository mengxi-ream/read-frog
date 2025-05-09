import { Button } from "@/components/ui/button";
import { BookOpenText, RotateCcw } from "lucide-react";
import { cn } from "@/utils/tailwind";
import { useReadArticle } from "@/hooks/read/read";
import { useExtractContent } from "@/hooks/read/extract";
import { useMutationState } from "@tanstack/react-query";

export const Metadata = ({ className }: { className?: string }) => {
  const title = document.title ?? "Untitled";
  const favicon = getFaviconUrl();
  const {
    mutate: readArticle,
    analyzeContent,
    explainArticle,
  } = useReadArticle();
  const { isPending: isExtractingContent, data: extractedContent } =
    useExtractContent();
  const explainData = useMutationState({
    filters: {
      mutationKey: ["explainArticle"],
    },
    select: (mutation) => mutation.state.data,
  });
  // TODO: show regenerate button at certain conditions and implement the logic

  return (
    <div
      className={cn(
        "relative flex justify-between items-center gap-x-2 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-md py-2 px-2",
        className
      )}
    >
      <div className="flex items-center gap-x-2 flex-1 min-w-0">
        {favicon && (
          <img
            src={favicon}
            alt="Favicon"
            className="w-4 h-4 flex-shrink-0 rounded-xs"
          />
        )}
        <h1 className="text-base font-semibold truncate">{title}</h1>
      </div>
      <Button
        size="sm"
        onClick={() => extractedContent && readArticle(extractedContent)}
        disabled={
          isExtractingContent ||
          analyzeContent.isPending ||
          explainArticle.isPending
        }
      >
        {explainData.length > 0 && explainData[explainData.length - 1] ? (
          <>
            <RotateCcw className="size-3" />
            Regenerate
          </>
        ) : (
          <>
            <BookOpenText className="size-3" />
            Read
          </>
        )}
      </Button>
    </div>
  );
};
