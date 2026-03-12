import type { LoadedData } from "../loader.js";

export interface LibrarySummary {
  id: string;
  title: string;
  component_count: number;
}

export interface ListSourcesOutput {
  indexed_at: string;
  source_commits: Record<string, string>;
  libraries: LibrarySummary[];
  total_pages: number;
  total_sections: number;
  page_counts: { guides: number; components: number; libraries: number };
}

export function handleListSources(data: LoadedData): ListSourcesOutput {
  let guides = 0;
  let components = 0;
  let libraryPages = 0;

  const libComponentCounts = new Map<string, number>();

  for (const page of data.pages) {
    switch (page.page_type) {
      case "guide":
        guides++;
        break;
      case "component":
        components++;
        if (page.library) {
          libComponentCounts.set(
            page.library,
            (libComponentCounts.get(page.library) ?? 0) + 1,
          );
        }
        break;
      case "library":
        libraryPages++;
        // Ensure library appears even if it has no components
        if (page.library && !libComponentCounts.has(page.library)) {
          libComponentCounts.set(page.library, 0);
        }
        break;
    }
  }

  const libraries: LibrarySummary[] = [...libComponentCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => ({ id, title: id, component_count: count }));

  return {
    indexed_at: data.metadata.indexed_at,
    source_commits: data.metadata.source_commits,
    libraries,
    total_pages: data.pages.length,
    total_sections: data.chunks.length,
    page_counts: { guides, components, libraries: libraryPages },
  };
}
