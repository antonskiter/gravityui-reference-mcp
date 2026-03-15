import { z } from "zod";

export const PageTypeSchema = z.enum(["guide", "component", "library"]);

export const PropDefSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  default: z.union([z.string(), z.boolean().transform(String), z.null()]).optional(),
  description: z.string().optional(),
  deprecated: z.boolean().optional(),
});

export const ComponentDefSchema = z.object({
  name: z.string(),
  library: z.string(),
  category: z.string().optional(),
  import_path: z.string(),
  import_statement: z.string(),
  props: z.array(PropDefSchema),
  examples: z.array(z.string()),
  description: z.string().optional(),
  source_file: z.string(),
});

export const PageSchema = z.object({
  id: z.string(),
  title: z.string(),
  page_type: PageTypeSchema,
  library: z.string().optional(),
  url: z.string(),
  github_url: z.string().optional(),
  breadcrumbs: z.array(z.string()),
  description: z.string(),
  section_ids: z.array(z.string()),
});

export const ChunkSchema = z.object({
  id: z.string(),
  page_id: z.string(),
  url: z.string(),
  page_title: z.string(),
  page_type: PageTypeSchema,
  library: z.string().optional(),
  section_title: z.string(),
  breadcrumbs: z.array(z.string()),
  content: z.string(),
  code_examples: z.array(z.string()),
  keywords: z.array(z.string()),
});

export const TokenSetSchema = z.object({
  spacing: z.record(z.string(), z.string()),
  breakpoints: z.record(z.string(), z.number()),
  sizes: z.record(z.string(), z.string()),
  colors: z.record(z.string(), z.string()).optional(),
});

export const CategoryMapSchema = z.object({
  categories: z.record(z.string(), z.string()),
  components: z.record(z.string(), z.string()),
});

export const SystemOverviewSchema = z.object({
  description: z.string(),
  theming: z.string(),
  spacing: z.string(),
  typography: z.string(),
  corner_radius: z.string(),
  branding: z.string(),
});

export const LibraryOverviewEntrySchema = z.object({
  id: z.string(),
  package: z.string(),
  purpose: z.string(),
  component_count: z.number(),
  depends_on: z.array(z.string()),
  is_peer_dependency_of: z.array(z.string()),
});

export const DesignSystemOverviewSchema = z.object({
  system: SystemOverviewSchema,
  libraries: z.array(LibraryOverviewEntrySchema),
});

export const ComponentTagsSchema = z.record(z.string(), z.array(z.string()));
