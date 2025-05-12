import { BookOpenText, RotateCcw } from "lucide-react";

import { useMutationState } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useExtractContent } from "@/hooks/read/extract";
import { useReadArticle } from "@/hooks/read/read";
import { cn } from "@/utils/tailwind";

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
        "relative flex items-center justify-between gap-x-2 rounded-md bg-neutral-100 px-2 py-2 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-x-2">
        {favicon && (
          <img
            src={favicon}
            alt="Favicon"
            className="h-4 w-4 flex-shrink-0 rounded-xs"
          />
        )}
        <h1 className="truncate text-base font-semibold">{title}</h1>
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
