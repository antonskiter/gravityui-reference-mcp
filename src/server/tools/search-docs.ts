import { searchIndex } from "../../ingest/index.js";
import type { LoadedData } from "../loader.js";
import { indent } from "../format.js";

export function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

export interface SearchDocsInput {
  query: string;
  limit?: number;
  page_type?: string;
  library?: string;
}

export interface SearchDocsResult {
  section_id: string;
  score: number;
  page_title: string;
  page_type: string;
  library?: string;
  section_title: string;
  snippet: string;
  url: string;
}

export interface SearchDocsOutput {
  results: SearchDocsResult[];
  total_matches: number;
}

export function handleSearchDocs(
  data: LoadedData,
  input: SearchDocsInput,
): SearchDocsOutput {
  const { query, limit = 5, page_type, library } = input;

  // Search with a higher internal limit so we can pre-filter
  const rawResults = searchIndex(data.index, query, 50);

  const seenPages = new Set<string>();
  const filtered: SearchDocsResult[] = [];
  for (const result of rawResults) {
    const chunk = data.chunkById.get(result.id);
    if (!chunk) continue;

    if (page_type && chunk.page_type !== page_type) continue;
    if (library && chunk.library !== library) continue;

    // Deduplicate: keep only the best-scoring section per page
    if (seenPages.has(chunk.page_id)) continue;
    seenPages.add(chunk.page_id);

    filtered.push({
      section_id: chunk.id,
      score: result.score,
      page_title: chunk.page_title,
      page_type: chunk.page_type,
      library: chunk.library,
      section_title: chunk.section_title,
      snippet: truncateAtWord(chunk.content, 200),
      url: chunk.url,
    });
  }

  const limited = filtered.slice(0, limit);

  return {
    results: limited,
    total_matches: filtered.length,
  };
}

export function formatSearchDocs(result: SearchDocsOutput): string {
  const { results, total_matches } = result;
  const lines: string[] = [`Found ${results.length} results (${total_matches} total)`];
  if (results.length > 0) {
    lines.push("");
    results.forEach((r, i) => {
      const lib = r.library ? `, ${r.library}` : "";
      lines.push(`${i + 1}. ${r.page_title} (${r.page_type}${lib}) score: ${Math.min(100, Math.round(r.score))}`);
      lines.push(indent(r.snippet));
      lines.push(`   Section: ${r.section_id} | ${r.url}`);
      if (i < results.length - 1) lines.push("");
    });
  }
  return lines.join("\n");
}
