export type PageType = "guide" | "component" | "library";

export interface Page {
  id: string;
  title: string;
  page_type: PageType;
  library?: string;
  url: string;
  github_url?: string;
  breadcrumbs: string[];
  description: string;
  section_ids: string[];
}

export interface Chunk {
  id: string;
  page_id: string;
  url: string;
  page_title: string;
  page_type: PageType;
  library?: string;
  section_title: string;
  breadcrumbs: string[];
  content: string;
  code_examples: string[];
  keywords: string[];
}

export interface RawPage {
  url: string;
  github_url: string;
  content: string;
  page_type: PageType;
  library?: string;
  name: string;
}

export interface IngestMetadata {
  indexed_at: string;
  source_commits: Record<string, string>;
}

export interface PageManifestEntry {
  raw_url: string;
  github_url: string;
  page_type: PageType;
  library?: string;
  name: string;
}
