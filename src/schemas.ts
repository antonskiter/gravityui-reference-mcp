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
  typography: z.record(z.string(), z.string()).optional(),
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

export const RecipeLevelSchema = z.enum(['foundation', 'molecule', 'organism']);

export const RecipeComponentItemSchema = z.object({
  name: z.string(),
  library: z.string(),
  usage: z.enum(['required', 'optional', 'alternative']),
  role: z.string(),
});

export const RecipeDecisionSectionSchema = z.object({
  type: z.literal('decision'),
  when: z.string(),
  not_for: z.string(),
  matrix: z.array(z.object({
    situation: z.string(),
    component: z.string(),
    why: z.string(),
  })).optional(),
});

export const RecipeSetupSectionSchema = z.object({
  type: z.literal('setup'),
  steps: z.array(z.string()),
  packages: z.array(z.string()).optional(),
});

export const RecipeComponentsSectionSchema = z.object({
  type: z.literal('components'),
  items: z.array(RecipeComponentItemSchema),
});

export const RecipeCustomPartsSectionSchema = z.object({
  type: z.literal('custom_parts'),
  items: z.array(z.object({
    name: z.string(),
    description: z.string(),
    approach: z.string(),
  })),
});

export const RecipeStructureSectionSchema = z.object({
  type: z.literal('structure'),
  tree: z.array(z.string()).optional(),
  flow: z.array(z.string()).optional(),
});

export const RecipeExampleSectionSchema = z.object({
  type: z.literal('example'),
  title: z.string(),
  code: z.string(),
});

export const RecipeAvoidSectionSchema = z.object({
  type: z.literal('avoid'),
  items: z.array(z.string()),
});

export const RecipeRelatedSectionSchema = z.object({
  type: z.literal('related'),
  items: z.array(z.object({
    id: z.string(),
    note: z.string(),
  })),
});

export const RecipeSectionSchema = z.discriminatedUnion('type', [
  RecipeDecisionSectionSchema,
  RecipeSetupSectionSchema,
  RecipeComponentsSectionSchema,
  RecipeCustomPartsSectionSchema,
  RecipeStructureSectionSchema,
  RecipeExampleSectionSchema,
  RecipeAvoidSectionSchema,
  RecipeRelatedSectionSchema,
]);

export const RecipeDefSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  level: RecipeLevelSchema,
  use_cases: z.array(z.string()),
  packages: z.array(z.string()),
  tags: z.array(z.string()),
  sections: z.array(RecipeSectionSchema),
});

export const HookDefSchema = z.object({
  name: z.string(),
  signature: z.string(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
  })),
  return_type: z.string(),
  import_path: z.string(),
  library: z.string(),
  rules_of_hooks: z.literal(true),
});

export const AssetDefSchema = z.object({
  name: z.string(),
  import_path: z.string(),
  library: z.string(),
  category: z.string().optional(),
});

export const ApiFunctionDefSchema = z.object({
  name: z.string(),
  kind: z.enum(['function', 'class', 'type', 'interface', 'enum', 'const']),
  signature: z.string(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
  })),
  return_type: z.string().optional(),
  description: z.string().optional(),
  import_path: z.string(),
  library: z.string(),
});

export const ConfigDocSchema = z.object({
  library: z.string(),
  npm_package: z.string(),
  description: z.string(),
  how_to_use: z.string(),
  readme: z.string(),
});
