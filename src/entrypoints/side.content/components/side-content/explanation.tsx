import { type ArticleExplanation } from "../../../../types/content";

const createCumulativeIndexMap = (
  articleExplanation: ArticleExplanation["paragraphs"],
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
  cumulativeIndexes: number[],
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
              cumulativeIndexes,
            );
            return (
              <div
                key={`${pIndex}-${sIndex}`}
                className={cn(
                  "px-3 py-2",
                  globalIndex % 2 === 0
                    ? "bg-background"
                    : "bg-neutral-100 dark:bg-neutral-800", // TODO: move this to variable
                )}
              >
                <div className="mb-2 inline-block bg-amber-400 px-1 py-0.5 text-sm dark:bg-amber-600">
                  Sentence {globalIndex + 1}
                </div>
                <div className="mb-1 text-base font-semibold">
                  {sentence.originalSentence}
                </div>
                <div className="text-muted-foreground mb-2 text-base">
                  {sentence.translatedSentence}
                </div>
                <div className="mb-2 flex items-center text-sm font-medium text-blue-500">
                  <div className="h-4 w-1 bg-blue-500"></div>
                  <span className="ml-2">Key Words</span>
                </div>
                {sentence.words.length > 0 && (
                  <ul className="mb-2 space-y-2">
                    {sentence.words.map((word, wIndex) => (
                      <li key={wIndex} className="text-sm">
                        <div className="mb-1 flex flex-wrap items-center gap-x-2">
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
                <div className="mb-2 flex items-center text-sm font-medium text-blue-500">
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
