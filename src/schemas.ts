import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

export const PropDefSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  default: z.union([z.string(), z.boolean().transform(String), z.null()]).optional(),
  description: z.string().optional(),
  deprecated: z.boolean().optional(),
});

export const ParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Recipe section schemas (must be defined before RecipeEntitySchema)
// ---------------------------------------------------------------------------

const RecipeDecisionSection = z.object({
  type: z.literal('decision'),
  when_to_use: z.array(z.string()).default([]),
  when_not_to_use: z.array(z.string()).default([]),
  choice_matrix: z.array(z.object({
    situation: z.string(),
    component: z.string(),
    why: z.string().optional(),
  })).default([]),
});

const RecipeSetupSection = z.object({
  type: z.literal('setup'),
  steps: z.array(z.string()).default([]),
});

const RecipeComponentsSection = z.object({
  type: z.literal('components'),
  items: z.array(z.object({
    name: z.string(),
    library: z.string(),
    role: z.string(),
    usage: z.enum(['required', 'optional', 'alternative']).default('required'),
  })),
});

const RecipeCustomPartsSection = z.object({
  type: z.literal('custom_parts'),
  items: z.array(z.object({
    name: z.string(),
    description: z.string(),
    approach: z.string(),
  })),
});

const RecipeStructureSection = z.object({
  type: z.literal('structure'),
  tree: z.array(z.string()).optional(),
  flow: z.array(z.string()).optional(),
});

const RecipeExampleSection = z.object({
  type: z.literal('example'),
  title: z.string(),
  code: z.string(),
});

const RecipeAvoidSection = z.object({
  type: z.literal('avoid'),
  items: z.array(z.string()),
});

const RecipeRelatedSection = z.object({
  type: z.literal('related'),
  items: z.array(z.object({
    id: z.string(),
    why: z.string().optional(),
  })),
});

export const RecipeSectionSchema = z.discriminatedUnion('type', [
  RecipeDecisionSection,
  RecipeSetupSection,
  RecipeComponentsSection,
  RecipeCustomPartsSection,
  RecipeStructureSection,
  RecipeExampleSection,
  RecipeAvoidSection,
  RecipeRelatedSection,
]);

// ---------------------------------------------------------------------------
// Entity base (shared fields)
// ---------------------------------------------------------------------------

const EntityBase = z.object({
  name: z.string(),
  library: z.string(),
  description: z.string(),
  keywords: z.array(z.string()).default([]),
  when_to_use: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  import_statement: z.string().default(''),
  related: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Entity variants (discriminated union by "type")
// ---------------------------------------------------------------------------

export const ComponentEntitySchema = EntityBase.extend({
  type: z.literal('component'),
  props: z.array(PropDefSchema).default([]),
  examples: z.array(z.string()).default([]),
});

export const HookEntitySchema = EntityBase.extend({
  type: z.literal('hook'),
  signature: z.string().optional(),
  return_type: z.string().optional(),
  parameters: z.array(ParameterSchema).default([]),
  examples: z.array(z.string()).default([]),
});

export const TokenSetEntitySchema = EntityBase.extend({
  type: z.literal('token-set'),
  values: z.record(z.string(), z.unknown()),
});

export const AssetEntitySchema = EntityBase.extend({
  type: z.literal('asset'),
  category: z.string().optional(),
});

export const UtilityEntitySchema = EntityBase.extend({
  type: z.literal('utility'),
  signature: z.string().optional(),
  return_type: z.string().optional(),
  parameters: z.array(ParameterSchema).default([]),
  examples: z.array(z.string()).default([]),
  kind: z.enum(['function', 'class', 'type', 'interface', 'enum', 'const']).default('function'),
});

export const ConfigDocEntitySchema = EntityBase.extend({
  type: z.literal('config-doc'),
  how_to_use: z.string().optional(),
  readme: z.string().optional(),
});

export const GuideEntitySchema = EntityBase.extend({
  type: z.literal('guide'),
  content: z.string().optional(),
});

export const LibraryEntitySchema = z.object({
  type: z.literal('library'),
  name: z.string(),
  library: z.string(),
  description: z.string(),
  keywords: z.array(z.string()).default([]),
  when_to_use: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  import_statement: z.string().default(''),
  related: z.array(z.string()).default([]),
  package: z.string().default(''),
  not_for: z.string().optional(),
  depends_on: z.array(z.string()).default([]),
  is_peer_dependency_of: z.array(z.string()).default([]),
  component_count: z.number().default(0),
});

export const RecipeEntitySchema = z.object({
  type: z.literal('recipe'),
  name: z.string(),
  library: z.string().default(''),
  description: z.string(),
  keywords: z.array(z.string()).default([]),
  when_to_use: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  import_statement: z.string().default(''),
  related: z.array(z.string()).default([]),
  title: z.string(),
  level: z.enum(['molecule', 'organism', 'foundation']).optional(),
  packages: z.array(z.string()).default([]),
  components: z.array(
    z.union([
      z.object({ name: z.string(), library: z.string(), role: z.string() }),
      z.string().transform(s => ({ name: s, library: '', role: '' })),
    ])
  ).default([]),
  sections: z.array(RecipeSectionSchema).default([]),
});

export const EntitySchema = z.discriminatedUnion('type', [
  ComponentEntitySchema,
  HookEntitySchema,
  TokenSetEntitySchema,
  AssetEntitySchema,
  UtilityEntitySchema,
  ConfigDocEntitySchema,
  GuideEntitySchema,
  LibraryEntitySchema,
  RecipeEntitySchema,
]);

// ---------------------------------------------------------------------------
// Library entities file (what entities/{lib}.json looks like)
// ---------------------------------------------------------------------------

export const LibraryEntitiesSchema = z.array(EntitySchema);

// ---------------------------------------------------------------------------
// Inferred types (single source of truth — no separate types.ts)
// ---------------------------------------------------------------------------

export type PropDef = z.infer<typeof PropDefSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type ComponentEntity = z.infer<typeof ComponentEntitySchema>;
export type HookEntity = z.infer<typeof HookEntitySchema>;
export type TokenSetEntity = z.infer<typeof TokenSetEntitySchema>;
export type AssetEntity = z.infer<typeof AssetEntitySchema>;
export type UtilityEntity = z.infer<typeof UtilityEntitySchema>;
export type ConfigDocEntity = z.infer<typeof ConfigDocEntitySchema>;
export type GuideEntity = z.infer<typeof GuideEntitySchema>;
export type LibraryEntity = z.infer<typeof LibraryEntitySchema>;
export type RecipeEntity = z.infer<typeof RecipeEntitySchema>;
export type RecipeSection = z.infer<typeof RecipeSectionSchema>;
