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

export interface IngestMetadata {
  indexed_at: string;
  source_commits: Record<string, string>;
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

export interface PropDef {
  name: string;
  type: string;           // e.g. "'s' | 'm' | 'l' | 'xl'"
  required: boolean;
  default?: string;       // e.g. "'m'"
  description?: string;   // from JSDoc
  deprecated?: boolean;
}

export interface ComponentDef {
  name: string;           // e.g. "Button"
  library: string;        // e.g. "uikit"
  category?: string;      // e.g. "layout", "forms", "feedback"
  import_path: string;    // e.g. "@gravity-ui/uikit"
  import_statement: string; // e.g. "import {Button} from '@gravity-ui/uikit';"
  props: PropDef[];
  examples: string[];     // code snippets from stories
  description?: string;   // from README first paragraph, if exists
  source_file: string;    // relative path in vendor/
}

export interface TokenSet {
  spacing: Record<string, string>;     // e.g. {"0": "0px", "1": "4px", ...}
  breakpoints: Record<string, number>; // e.g. {"xs": 0, "s": 576, ...}
  sizes: Record<string, string>;       // e.g. {"xs": "20px", "s": "24px", ...}
  colors?: Record<string, string>;     // semantic color tokens if extractable
}

export interface CategoryMap {
  categories: Record<string, string>; // slug → display name
  components: Record<string, string>; // ComponentName → category slug
}
