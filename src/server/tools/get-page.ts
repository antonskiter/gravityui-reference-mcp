import type { LoadedData } from "../loader.js";
import { truncateAtWord } from "./search-docs.js";

export interface GetPageInput {
  page_id: string;
}

export interface SectionSummary {
  section_id: string;
  section_title: string;
  summary: string;
  has_code: boolean;
}

export interface GetPageOutput {
  page_id: string;
  title: string;
  page_type: string;
  library?: string;
  url: string;
  github_url?: string;
  description: string;
  breadcrumbs: string[];
  sections: SectionSummary[];
}

export interface GetPageError {
  error: string;
}

export function handleGetPage(
  data: LoadedData,
  input: GetPageInput,
): GetPageOutput | GetPageError {
  const page = data.pageById.get(input.page_id);
  if (!page) {
    return { error: `Page not found: ${input.page_id}` };
  }

  const sections: SectionSummary[] = page.section_ids
    .map(id => {
      const chunk = data.chunkById.get(id);
      if (!chunk) return null;
      return {
        section_id: chunk.id,
        section_title: chunk.section_title,
        summary: truncateAtWord(chunk.content, 150),
        has_code: chunk.code_examples.length > 0,
      };
    })
    .filter((s): s is SectionSummary => s !== null);

  return {
    page_id: page.id,
    title: page.title,
    page_type: page.page_type,
    library: page.library,
    url: page.url,
    github_url: page.github_url,
    description: page.description,
    breadcrumbs: page.breadcrumbs,
    sections,
  };
}
