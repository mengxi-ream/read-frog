import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Explanation from "./explanation";
import { useExtractContent } from "@/hooks/read/extract";
import { useAtom, useAtomValue } from "jotai";
import { progressAtom, readStateAtom } from "../../atoms";
import LoadingDots from "@/components/loading-dots";
import { Progress } from "@/components/ui/progress";
import { useExplainArticle } from "@/hooks/read/read";
import { useMutationState } from "@tanstack/react-query";
import { ArticleAnalysis, ArticleExplanation } from "@/types/content";

export default function Content() {
  const progress = useAtomValue(progressAtom);
  const [readState, setReadState] = useAtom(readStateAtom);
  const { isPending: isExtractingContent, data: extractedContent } =
    useExtractContent();
  const { mutate: explainArticle } = useExplainArticle();

  const explainDataList = useMutationState({
    filters: {
      mutationKey: ["explainArticle"],
    },
    select: (mutation) => mutation.state.data,
  });

  const analyzeContentDataList = useMutationState({
    filters: {
      mutationKey: ["analyzeContent"],
    },
    select: (mutation) => mutation.state.data,
  });

  // const handleReadForMe = () => {
  //   if (!extractedContent?.paragraphs.join("\n").trim()) {
  //     toast.error("Cannot read the content: content is not available");
  //     return;
  //   }
  //   readArticle(extractedContent);
  // };

  const handleContinue = () => {
    const analyzeContentData =
      analyzeContentDataList[analyzeContentDataList.length - 1];
    if (extractedContent && analyzeContentData) {
      explainArticle({
        extractedContent,
        articleAnalysis: analyzeContentData as ArticleAnalysis,
      });
      setReadState("explaining");
    } else {
      toast.error("Cannot generate the explanation: content is not available");
    }
  };

  if (isExtractingContent) {
    return (
      <div className="flex-1 flex h-full w-full justify-center items-center p-4 gap-x-2">
        <LoadingDots />
        Extracting content...
      </div>
    );
  }

  if (readState === "analyzing") {
    return (
      <div className="flex-1 flex h-full w-full justify-center items-center p-4 gap-x-2">
        <LoadingDots />
        Analyzing...
      </div>
    );
  }

  if (readState === "continue?") {
    return (
      <div className="flex-1 flex h-full w-full justify-center items-center p-4 gap-x-2">
        <div className="flex flex-col gap-6">
          <p>
            The content does not appear to be an article or book. Are you sure
            you want to proceed?
          </p>
          <Button className="mx-auto" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (readState === "explaining") {
    return (
      <div className="flex-1 flex h-full w-full justify-center items-center p-4 gap-x-2">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <LoadingDots />
            Generating...
          </div>
          <Progress
            value={
              progress.total !== 0
                ? (progress.completed / progress.total) * 100
                : 0
            }
          />
        </div>
      </div>
    );
  }
  return (
    <>
      {explainDataList.length > 0 &&
      explainDataList[explainDataList.length - 1] ? (
        <ScrollArea className="flex-1 h-full">
          <Explanation
            articleExplanation={
              explainDataList[
                explainDataList.length - 1
              ] as ArticleExplanation["paragraphs"]
            }
          />
        </ScrollArea>
      ) : null}
    </>
  );
}
