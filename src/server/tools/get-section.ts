import type { LoadedData } from "../loader.js";

export interface GetSectionInput {
  section_id: string;
}

export interface RelatedSection {
  section_id: string;
  section_title: string;
}

export interface GetSectionOutput {
  section_id: string;
  page_id: string;
  page_title: string;
  page_type: string;
  library?: string;
  section_title: string;
  content: string;
  code_examples: string[];
  url: string;
  related_sections: RelatedSection[];
}

export interface GetSectionError {
  error: string;
}

export function handleGetSection(
  data: LoadedData,
  input: GetSectionInput,
): GetSectionOutput | GetSectionError {
  const chunk = data.chunkById.get(input.section_id);
  if (!chunk) {
    return { error: `Section not found: ${input.section_id}` };
  }

  const page = data.pageById.get(chunk.page_id);

  // Sibling chunks: other chunks on the same page, excluding current
  const siblingIds = page ? page.section_ids.filter(id => id !== chunk.id) : [];
  const related_sections: RelatedSection[] = siblingIds
    .map(id => {
      const sibling = data.chunkById.get(id);
      if (!sibling) return null;
      return { section_id: sibling.id, section_title: sibling.section_title };
    })
    .filter((s): s is RelatedSection => s !== null);

  return {
    section_id: chunk.id,
    page_id: chunk.page_id,
    page_title: chunk.page_title,
    page_type: chunk.page_type,
    library: chunk.library,
    section_title: chunk.section_title,
    content: chunk.content,
    code_examples: chunk.code_examples,
    url: chunk.url,
    related_sections,
  };
}
