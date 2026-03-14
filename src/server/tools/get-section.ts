import type { LoadedData } from "../loader.js";
import { codeBlock } from "../format.js";

export interface GetSectionInput {
  section_id: string;
}

export interface RelatedSection {
  section_id: string;
  title: string;
}

export interface GetSectionOutput {
  section_id: string;
  page_id: string;
  page_title: string;
  page_type: string;
  library?: string;
  section_title: string;
  breadcrumbs: string[];
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
      return { section_id: sibling.id, title: sibling.section_title };
    })
    .filter((s): s is RelatedSection => s !== null);

  return {
    section_id: chunk.id,
    page_id: chunk.page_id,
    page_title: chunk.page_title,
    page_type: chunk.page_type,
    library: chunk.library,
    section_title: chunk.section_title,
    breadcrumbs: chunk.breadcrumbs,
    content: chunk.content,
    code_examples: chunk.code_examples,
    url: chunk.url,
    related_sections,
  };
}

export function formatGetSection(result: GetSectionOutput | GetSectionError): string {
  if ("error" in result) return `Error: ${result.error}`;
  const lib = result.library ? ` (${result.library})` : "";
  const breadcrumbs = result.breadcrumbs.join(" > ");
  const lines: string[] = [
    `## ${result.section_title}`,
    `Page: ${result.page_title}${lib} | ${result.url}`,
    `Breadcrumbs: ${breadcrumbs}`,
    "",
    result.content,
  ];
  if (result.code_examples.length > 0) {
    lines.push("");
    for (const code of result.code_examples) {
      lines.push(codeBlock("tsx", code));
    }
  }
  if (result.related_sections.length > 0) {
    lines.push("");
    const related = result.related_sections.map(s => `\`${s.section_id}\` (${s.title})`).join(", ");
    lines.push(`**Related sections:** ${related}`);
  }
  return lines.join("\n");
}
