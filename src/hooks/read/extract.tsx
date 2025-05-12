import { franc } from "franc-min";
import { useSetAtom } from "jotai";

import { Readability } from "@mozilla/readability";
import { useQuery } from "@tanstack/react-query";

import { flattenToParagraphs } from "@/entrypoints/side.content/utils/article";
import { LangCodeISO6393 } from "@/types/config/languages";
import { ExtractedContent } from "@/types/content";
import { configFields } from "@/utils/atoms/config";

export function useExtractContent() {
  const setLanguage = useSetAtom(configFields.language);

  return useQuery<ExtractedContent>({
    queryKey: ["extractContent"],
    queryFn: async () => {
      const documentClone = document.cloneNode(true);
      const article = new Readability(documentClone as Document, {
        serializer: (el) => el,
      }).parse();
      const paragraphs = article?.content
        ? flattenToParagraphs(article.content)
        : [];

      // TODO: in analyzing, we should re-extract the article in case it changed, and reset the lang
      const lang = article?.textContent ? franc(article.textContent) : "und";

      if (import.meta.env.DEV) {
        console.log("franc detected lang", lang);
      }

      setLanguage({
        detectedCode: lang === "und" ? "eng" : (lang as LangCodeISO6393),
      });

      return {
        article: {
          ...article,
          lang,
        },
        paragraphs,
      };
    },
  });
}
