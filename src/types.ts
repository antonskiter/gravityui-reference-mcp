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

export type ComponentTags = Record<string, string[]>;

export interface SystemOverview {
  description: string;
  theming: string;
  spacing: string;
  typography: string;
  corner_radius: string;
  branding: string;
}

export interface LibraryOverviewEntry {
  id: string;
  package: string;
  purpose: string;
  component_count: number;
  depends_on: string[];
  is_peer_dependency_of: string[];
}

export interface DesignSystemOverview {
  system: SystemOverview;
  libraries: LibraryOverviewEntry[];
}
