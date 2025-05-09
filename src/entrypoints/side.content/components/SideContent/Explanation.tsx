import { type ArticleExplanation } from "../../../../types/content";

const createCumulativeIndexMap = (
  articleExplanation: ArticleExplanation["paragraphs"]
): number[] => {
  const cumulativeIndexes: number[] = [];
  let total = 0;

  for (const paragraph of articleExplanation) {
    cumulativeIndexes.push(total);
    total += paragraph.length;
  }

  return cumulativeIndexes;
};

const getGlobalIndex = (
  pIndex: number,
  sIndex: number,
  cumulativeIndexes: number[]
): number => {
  return cumulativeIndexes[pIndex] + sIndex;
};

export default function Explanation({
  articleExplanation,
}: {
  articleExplanation: ArticleExplanation["paragraphs"];
}) {
  const cumulativeIndexes = createCumulativeIndexMap(articleExplanation);

  return (
    <>
      {articleExplanation.map((paragraph, pIndex) => (
        <div key={pIndex}>
          {paragraph.map((sentence, sIndex) => {
            const globalIndex = getGlobalIndex(
              pIndex,
              sIndex,
              cumulativeIndexes
            );
            return (
              <div
                key={`${pIndex}-${sIndex}`}
                className={cn(
                  "py-2 px-3",
                  globalIndex % 2 === 0
                    ? "bg-background"
                    : "bg-neutral-100 dark:bg-neutral-800" // TODO: move this to variable
                )}
              >
                <div className="py-0.5 px-1 text-sm bg-amber-400 dark:bg-amber-600 inline-block mb-2">
                  Sentence {globalIndex + 1}
                </div>
                <div className="text-base mb-1 font-semibold">
                  {sentence.originalSentence}
                </div>
                <div className="text-base mb-2 text-muted-foreground">
                  {sentence.translatedSentence}
                </div>
                <div className="text-sm font-medium mb-2 text-blue-500 flex items-center">
                  <div className="h-4 w-1 bg-blue-500"></div>
                  <span className="ml-2">Key Words</span>
                </div>
                {sentence.words.length > 0 && (
                  <ul className="space-y-2 mb-2">
                    {sentence.words.map((word, wIndex) => (
                      <li key={wIndex} className="text-sm">
                        <div className="flex items-center gap-x-2 flex-wrap mb-1">
                          <span className="font-semibold">
                            {wIndex + 1}. {word.word}
                          </span>
                          <span className="text-muted-foreground">
                            {word.syntacticCategory}
                          </span>
                        </div>
                        {word.explanation}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="text-sm font-medium mb-2 text-blue-500 flex items-center">
                  <div className="h-4 w-1 bg-blue-500"></div>
                  <span className="ml-2">Explanation</span>
                </div>
                <div className="text-sm">{sentence.explanation}</div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
