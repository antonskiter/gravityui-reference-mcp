import type { LoadedData } from "../loader.js";
import type { PageType } from "../../types.js";

export interface PageTypeStats {
  page_count: number;
  section_count: number;
}

export interface ListSourcesOutput {
  indexed_at: string;
  source_commits: Record<string, string>;
  total_pages: number;
  total_sections: number;
  by_type: Record<PageType, PageTypeStats>;
}

export function handleListSources(data: LoadedData): ListSourcesOutput {
  const byType: Record<string, PageTypeStats> = {};

  for (const page of data.pages) {
    const type = page.page_type;
    if (!byType[type]) {
      byType[type] = { page_count: 0, section_count: 0 };
    }
    byType[type].page_count += 1;
    byType[type].section_count += page.section_ids.length;
  }

  return {
    indexed_at: data.metadata.indexed_at,
    source_commits: data.metadata.source_commits,
    total_pages: data.pages.length,
    total_sections: data.chunks.length,
    by_type: byType as Record<PageType, PageTypeStats>,
  };
}
