# Recipes & Tool Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 5 specialized MCP tools with 3 intent-based tools (find/get/list) and add a recipe data layer for component composition patterns.

**Architecture:** Add RecipeDef types + Zod schemas, extend LoadedData with recipes, create 3 new tool handlers that route across all entity types (components, recipes, tokens, libraries, docs), consolidate 5 v4 recipe drafts into data/recipes.json.

**Tech Stack:** TypeScript, MCP SDK, Zod, MiniSearch, vitest

**Spec:** docs/superpowers/specs/2026-03-17-recipes-and-tool-redesign.md

---

## Chunk 1: Data Layer (Types, Schemas, Loader, Validation, Recipe Data)

Depends on: nothing (foundational)

This chunk adds RecipeDef types, Zod schemas for recipe validation, extends TokenSet for typography, extends LoadedData and the loader with recipes, extends validation for recipes, and consolidates the 5 v4 recipe drafts into a single data/recipes.json.

Conventions inherited from existing code:
- Types in `src/types.ts`, Zod schemas in `src/schemas.ts`
- Loader in `src/server/loader.ts` uses `loadJsonFile` / `loadJsonArray`
- Validation in `src/ingest/validate.ts` uses `tryParse` helper
- Test command: `pnpm test -- --run {test-file}`

---

### Task 1: Add RecipeDef types + Zod schemas

Files: `src/types.ts`, `src/schemas.ts`, `src/schemas.test.ts`

- [ ] Step 1: Add RecipeDef types to src/types.ts

```typescript
// Append to src/types.ts

export type RecipeLevel = 'foundation' | 'molecule' | 'organism';

export interface RecipeComponentItem {
  name: string;
  library: string;
  usage: 'required' | 'optional' | 'alternative';
  role: string;
}

export interface RecipeDecisionSection {
  type: 'decision';
  when: string;
  not_for: string;
  matrix?: { situation: string; component: string; why: string }[];
}

export interface RecipeSetupSection {
  type: 'setup';
  steps: string[];
  packages?: string[];
}

export interface RecipeComponentsSection {
  type: 'components';
  items: RecipeComponentItem[];
}

export interface RecipeCustomPartsSection {
  type: 'custom_parts';
  items: { name: string; description: string; approach: string }[];
}

export interface RecipeStructureSection {
  type: 'structure';
  tree?: string[];
  flow?: string[];
}

export interface RecipeExampleSection {
  type: 'example';
  title: string;
  code: string;
}

export interface RecipeAvoidSection {
  type: 'avoid';
  items: string[];
}

export interface RecipeRelatedSection {
  type: 'related';
  items: { id: string; note: string }[];
}

export type RecipeSection =
  | RecipeDecisionSection
  | RecipeSetupSection
  | RecipeComponentsSection
  | RecipeCustomPartsSection
  | RecipeStructureSection
  | RecipeExampleSection
  | RecipeAvoidSection
  | RecipeRelatedSection;

export interface RecipeDef {
  id: string;
  title: string;
  description: string;
  level: RecipeLevel;
  use_cases: string[];
  packages: string[];
  tags: string[];
  sections: RecipeSection[];
}
```

- [ ] Step 2: Add Zod schemas for recipes to src/schemas.ts

```typescript
// Append to src/schemas.ts

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
```

- [ ] Step 3: Write failing tests for recipe schemas in src/schemas.test.ts

```typescript
// Append to src/schemas.test.ts

import {
  RecipeLevelSchema,
  RecipeDefSchema,
  RecipeSectionSchema,
} from "./schemas.js";

describe("RecipeLevelSchema", () => {
  it("accepts valid levels", () => {
    expect(RecipeLevelSchema.parse("foundation")).toBe("foundation");
    expect(RecipeLevelSchema.parse("molecule")).toBe("molecule");
    expect(RecipeLevelSchema.parse("organism")).toBe("organism");
  });

  it("rejects invalid levels", () => {
    expect(() => RecipeLevelSchema.parse("atom")).toThrow();
    expect(() => RecipeLevelSchema.parse("")).toThrow();
  });
});

describe("RecipeSectionSchema", () => {
  it("accepts a valid decision section", () => {
    const result = RecipeSectionSchema.parse({
      type: "decision",
      when: "User needs to confirm an action",
      not_for: "Multi-step wizards",
    });
    expect(result.type).toBe("decision");
  });

  it("accepts a decision section with matrix", () => {
    const result = RecipeSectionSchema.parse({
      type: "decision",
      when: "Showing feedback",
      not_for: "Persistent messages",
      matrix: [
        { situation: "success", component: "Toaster", why: "Non-blocking" },
      ],
    });
    expect(result.type).toBe("decision");
    if (result.type === "decision") {
      expect(result.matrix).toHaveLength(1);
    }
  });

  it("accepts a valid components section", () => {
    const result = RecipeSectionSchema.parse({
      type: "components",
      items: [
        { name: "Dialog", library: "uikit", usage: "required", role: "overlay" },
      ],
    });
    expect(result.type).toBe("components");
  });

  it("accepts a valid example section", () => {
    const result = RecipeSectionSchema.parse({
      type: "example",
      title: "Basic usage",
      code: "<Button>Click</Button>",
    });
    expect(result.type).toBe("example");
  });

  it("accepts a valid structure section with tree and flow", () => {
    const result = RecipeSectionSchema.parse({
      type: "structure",
      tree: ["Button", "  Dialog"],
      flow: ["User clicks -> open dialog"],
    });
    expect(result.type).toBe("structure");
  });

  it("accepts a valid avoid section", () => {
    const result = RecipeSectionSchema.parse({
      type: "avoid",
      items: ["Custom modal -- ConfirmDialog handles it"],
    });
    expect(result.type).toBe("avoid");
  });

  it("accepts a valid related section", () => {
    const result = RecipeSectionSchema.parse({
      type: "related",
      items: [{ id: "user-feedback", note: "Use Toaster after action" }],
    });
    expect(result.type).toBe("related");
  });

  it("rejects an unknown section type", () => {
    expect(() => RecipeSectionSchema.parse({
      type: "unknown",
      data: "test",
    })).toThrow();
  });

  it("rejects a components section with invalid usage value", () => {
    expect(() => RecipeSectionSchema.parse({
      type: "components",
      items: [
        { name: "Dialog", library: "uikit", usage: "mandatory", role: "overlay" },
      ],
    })).toThrow();
  });
});

describe("RecipeDefSchema", () => {
  const minimal = {
    id: "confirmation-dialog",
    title: "Confirmation Dialog",
    description: "A confirmation dialog pattern",
    level: "molecule",
    use_cases: ["confirm deletion"],
    packages: ["@gravity-ui/uikit"],
    tags: ["confirm", "dialog"],
    sections: [
      {
        type: "decision",
        when: "User must confirm an action",
        not_for: "Multi-step wizards",
      },
      {
        type: "example",
        title: "Basic",
        code: "<ConfirmDialog />",
      },
    ],
  };

  it("accepts a valid minimal RecipeDef", () => {
    const result = RecipeDefSchema.parse(minimal);
    expect(result.id).toBe("confirmation-dialog");
    expect(result.level).toBe("molecule");
    expect(result.sections).toHaveLength(2);
  });

  it("accepts a RecipeDef with all section types", () => {
    const full = {
      ...minimal,
      sections: [
        { type: "decision", when: "when", not_for: "not_for" },
        { type: "setup", steps: ["npm install"] },
        { type: "components", items: [{ name: "Dialog", library: "uikit", usage: "required", role: "overlay" }] },
        { type: "custom_parts", items: [{ name: "Dropzone", description: "drag area", approach: "use DS tokens" }] },
        { type: "structure", tree: ["Dialog"], flow: ["open -> close"] },
        { type: "example", title: "Basic", code: "<Dialog />" },
        { type: "avoid", items: ["Custom modal"] },
        { type: "related", items: [{ id: "theming", note: "setup theme first" }] },
      ],
    };
    const result = RecipeDefSchema.parse(full);
    expect(result.sections).toHaveLength(8);
  });

  it("rejects a RecipeDef missing required fields", () => {
    expect(() => RecipeDefSchema.parse({ id: "test" })).toThrow();
  });

  it("rejects a RecipeDef with invalid level", () => {
    expect(() => RecipeDefSchema.parse({
      ...minimal,
      level: "atom",
    })).toThrow();
  });

  it("accepts extra fields in sections (passthrough)", () => {
    const withExtra = {
      ...minimal,
      sections: [
        {
          type: "decision",
          when: "when",
          not_for: "not for",
        },
        {
          type: "example",
          title: "Basic",
          code: "<X />",
        },
      ],
    };
    const result = RecipeDefSchema.parse(withExtra);
    expect(result.sections).toHaveLength(2);
  });
});
```

Run: `pnpm test -- --run src/schemas.test.ts`
Expect: new recipe tests pass (schemas are implemented in Step 2).

- [ ] Step 4: Commit

```
git add src/types.ts src/schemas.ts src/schemas.test.ts
git commit -m "feat: add RecipeDef types and Zod schemas for recipe data layer"
```

---

### Task 2: Extend TokenSet for typography

Files: `src/types.ts`, `src/schemas.ts`

- [ ] Step 1: Add typography field to TokenSet interface in src/types.ts

```typescript
// In src/types.ts, update TokenSet:
export interface TokenSet {
  spacing: Record<string, string>;
  breakpoints: Record<string, number>;
  sizes: Record<string, string>;
  colors?: Record<string, string>;
  typography?: Record<string, string>;  // NEW: named type scales
}
```

- [ ] Step 2: Add typography to TokenSetSchema in src/schemas.ts

```typescript
// In src/schemas.ts, update TokenSetSchema:
export const TokenSetSchema = z.object({
  spacing: z.record(z.string(), z.string()),
  breakpoints: z.record(z.string(), z.number()),
  sizes: z.record(z.string(), z.string()),
  colors: z.record(z.string(), z.string()).optional(),
  typography: z.record(z.string(), z.string()).optional(),  // NEW
});
```

- [ ] Step 3: Update TokenSet tests in src/schemas.test.ts

```typescript
// Add to the existing TokenSetSchema describe block:

  it("accepts a TokenSet with typography", () => {
    const withTypo = {
      ...valid,
      typography: { body1: "14px/20px Inter", heading1: "28px/36px Inter" },
    };
    const result = TokenSetSchema.parse(withTypo);
    expect(result.typography?.["body1"]).toBe("14px/20px Inter");
  });
```

Run: `pnpm test -- --run src/schemas.test.ts`
Expect: all tests pass.

- [ ] Step 4: Commit

```
git add src/types.ts src/schemas.ts src/schemas.test.ts
git commit -m "feat: extend TokenSet with optional typography field"
```

---

### Task 3: Extend LoadedData + loader with recipes

Files: `src/server/loader.ts`, `src/server/loader.test.ts`

- [ ] Step 1: Add recipes fields to LoadedData interface and loadData function

```typescript
// In src/server/loader.ts:

// Add to imports:
import type { RecipeDef } from "../types.js";

// Add to LoadedData interface:
export interface LoadedData {
  // ... existing fields ...
  recipes: RecipeDef[];
  recipeById: Map<string, RecipeDef>;
}

// Add to loadData function, after categoryMap loading:
  const recipes: RecipeDef[] = loadJsonFile<RecipeDef[]>(join(DATA_DIR, "recipes.json"), []);

  const recipeById = new Map<string, RecipeDef>();
  for (const recipe of recipes) {
    recipeById.set(recipe.id, recipe);
  }

// Add recipes and recipeById to the return object
```

- [ ] Step 2: Write tests for recipe loading in src/server/loader.test.ts

```typescript
// Add to the existing loadJsonFile describe block in loader.test.ts:

  it('loads recipes from recipes.json', () => {
    const recipes = [
      {
        id: 'confirmation-dialog',
        title: 'Confirmation Dialog',
        description: 'A dialog pattern',
        level: 'molecule',
        use_cases: ['confirm delete'],
        packages: ['@gravity-ui/uikit'],
        tags: ['confirm'],
        sections: [],
      },
    ];
    const filePath = join(tmpDir, 'recipes.json');
    writeFileSync(filePath, JSON.stringify(recipes));

    const result = loadJsonFile(filePath, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('confirmation-dialog');
  });

  it('returns empty array when recipes.json does not exist', () => {
    const filePath = join(tmpDir, 'recipes.json');
    const result = loadJsonFile(filePath, []);
    expect(result).toEqual([]);
  });
```

Run: `pnpm test -- --run src/server/loader.test.ts`
Expect: all tests pass.

- [ ] Step 3: Commit

```
git add src/server/loader.ts src/server/loader.test.ts
git commit -m "feat: extend LoadedData with recipes + recipeById map"
```

---

### Task 4: Extend validation for recipes

Files: `src/ingest/validate.ts`, `src/ingest/validate.test.ts`

- [ ] Step 1: Add recipe validation to validateDataDir

```typescript
// In src/ingest/validate.ts:

// Add to imports:
import { RecipeDefSchema } from "../schemas.js";

// Add after overview validation (step 6), before cross-reference checks:

  // 7. Validate recipes (optional file)
  const recipesPath = join(dataDir, 'recipes.json');
  let recipes: any[] | null = null;
  if (existsSync(recipesPath)) {
    const rawRecipes = loadJsonFile(recipesPath, []);
    recipes = tryParse(z.array(RecipeDefSchema), rawRecipes, 'recipes', result);
  }

// Add to cross-reference checks section:

  // 7d. Recipe component names must exist in component data
  if (recipes && components) {
    const componentNames = new Set(components.map(c => c.name));
    for (const recipe of recipes) {
      for (const section of recipe.sections) {
        if (section.type === 'components') {
          for (const item of section.items) {
            if (!componentNames.has(item.name)) {
              result.warnings.push(
                `Recipe "${recipe.id}" references component "${item.name}" not found in component data`
              );
            }
          }
        }
      }
    }
  }

  // 7e. Recipe must have at least one example section
  if (recipes) {
    for (const recipe of recipes) {
      const hasExample = recipe.sections.some((s: any) => s.type === 'example');
      if (!hasExample) {
        result.warnings.push(
          `Recipe "${recipe.id}" has no example section`
        );
      }
    }
  }

  // 7f. Recipe must have a decision section
  if (recipes) {
    for (const recipe of recipes) {
      const hasDecision = recipe.sections.some((s: any) => s.type === 'decision');
      if (!hasDecision) {
        result.warnings.push(
          `Recipe "${recipe.id}" has no decision section`
        );
      }
    }
  }

  // 7g. Related recipe IDs should exist (warning only)
  if (recipes) {
    const recipeIds = new Set(recipes.map((r: any) => r.id));
    for (const recipe of recipes) {
      for (const section of recipe.sections) {
        if (section.type === 'related') {
          for (const item of section.items) {
            if (!recipeIds.has(item.id)) {
              result.warnings.push(
                `Recipe "${recipe.id}" references related recipe "${item.id}" which does not exist`
              );
            }
          }
        }
      }
    }
  }
```

- [ ] Step 2: Write tests for recipe validation

```typescript
// Add to src/ingest/validate.test.ts:

function makeRecipes() {
  return [
    {
      id: 'confirmation-dialog',
      title: 'Confirmation Dialog',
      description: 'A confirmation dialog pattern',
      level: 'molecule',
      use_cases: ['confirm delete'],
      packages: ['@gravity-ui/uikit'],
      tags: ['confirm', 'dialog'],
      sections: [
        {
          type: 'decision',
          when: 'User must confirm action',
          not_for: 'Multi-step wizards',
        },
        {
          type: 'components',
          items: [
            { name: 'Button', library: 'uikit', usage: 'required', role: 'trigger' },
          ],
        },
        {
          type: 'example',
          title: 'Basic',
          code: '<ConfirmDialog />',
        },
      ],
    },
  ];
}

// Update writeFixtures to include recipes:
// Add to writeFixtures:
//   writeFileSync(join(dir, 'recipes.json'), JSON.stringify(overrides.recipes ?? makeRecipes()));

describe('validateDataDir — recipes', () => {
  it('passes with valid recipes', () => {
    writeFixtures(TMP_DIR, { recipes: makeRecipes() });
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it('reports fatal error for invalid recipe schema', () => {
    writeFixtures(TMP_DIR, {
      recipes: [{ id: 'bad', title: 'Bad', bad_field: true }],
    });
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('warns when recipe references non-existent component', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'decision', when: 'w', not_for: 'n' },
        {
          type: 'components',
          items: [{ name: 'NonExistent', library: 'uikit', usage: 'required', role: 'test' }],
        },
        { type: 'example', title: 'test', code: '<X />' },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('NonExistent'))).toBe(true);
  });

  it('warns when recipe has no example section', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'decision', when: 'w', not_for: 'n' },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('no example'))).toBe(true);
  });

  it('warns when recipe has no decision section', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'example', title: 'test', code: '<X />' },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('no decision'))).toBe(true);
  });

  it('warns when related recipe ID does not exist', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'decision', when: 'w', not_for: 'n' },
        { type: 'example', title: 'test', code: '<X />' },
        { type: 'related', items: [{ id: 'nonexistent-recipe', note: 'test' }] },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('nonexistent-recipe'))).toBe(true);
  });
});
```

Run: `pnpm test -- --run src/ingest/validate.test.ts`
Expect: all tests pass.

- [ ] Step 3: Commit

```
git add src/ingest/validate.ts src/ingest/validate.test.ts
git commit -m "feat: add recipe validation with cross-reference checks"
```

---

### Task 5: Create data/recipes.json consolidated from drafts

File: `data/recipes.json`

- [ ] Step 1: Consolidate 5 v4 recipe drafts into a single JSON array

Read the 5 draft files:
- `data/recipes-v4-confirmation.json` (confirmation-dialog)
- `data/recipes-v4-page-states.json` (page-states)
- `data/recipes-v4-theming.json` (theming-dark-mode)
- `data/recipes-v4-data-table.json` (data-table)
- `data/recipes-v4-file-upload.json` (file-upload)

Create `data/recipes.json` as a JSON array containing all 5 recipes. Verify each recipe conforms to the RecipeDefSchema. Fix any field mismatches (e.g. library field should be short ID like "uikit" not package name like "@gravity-ui/uikit" in the components section items).

The file should be a JSON array:
```json
[
  { "id": "theming-dark-mode", ... },
  { "id": "confirmation-dialog", ... },
  { "id": "page-states", ... },
  { "id": "data-table", ... },
  { "id": "file-upload", ... }
]
```

Order: foundation first, then molecule, then organism (matching the atomic design scale).

- [ ] Step 2: Validate the consolidated file

```
pnpm build && npx tsx src/ingest/run-validate.ts
```

Expect: no fatal errors. Warnings for missing related recipe IDs (user-feedback, settings-page) are acceptable since those recipes are not yet created.

- [ ] Step 3: Commit

```
git add data/recipes.json
git commit -m "feat: consolidate 5 v4 recipe drafts into data/recipes.json"
```

---

## Chunk 2: Tool Handlers (find, get, list)

Depends on: Chunk 1 (RecipeDef types, LoadedData.recipes + recipeById)

This chunk creates 3 new handler files following the existing pattern: input/output interfaces, handleX function, formatX function (formatting is Chunk 3 — stubs only here). Each handler is pure logic operating on LoadedData. No server wiring (Chunk 4).

Conventions inherited from existing handlers:
- Import LoadedData from `../loader.js`
- Import types from `../../types.js`
- Reuse scoring utilities from `./suggest-component.js`
- All functions exported for testability
- Tests use `as any` casts for partial LoadedData mocks
- Test command: `pnpm test -- --run src/server/tools/__tests__/{test-file}.test.ts`

Assumed Chunk 1 additions to LoadedData:
- `recipes: RecipeDef[]` — all loaded recipes
- `recipeById: Map<string, RecipeDef>` — keyed by recipe.id (kebab-case)

Assumed RecipeDef shape (from spec):
- id, title, description, level, use_cases: string[], packages: string[], tags: string[]
- sections: RecipeSection[] (discriminated union on `type` field)

Library priority constant (reused by get and find):

```typescript
// src/server/tools/lib-priority.ts
export const LIBRARY_PRIORITY: string[] = [
  'uikit', 'components', 'navigation',
  'date-components', 'page-constructor', 'table', 'blog-constructor',
];

export function pickByLibraryPriority<T extends { library: string }>(items: T[]): T | undefined {
  for (const lib of LIBRARY_PRIORITY) {
    const match = items.find(i => i.library === lib);
    if (match) return match;
  }
  return items[0];
}
```

---

### Task 6: find() handler

File: `src/server/tools/find.ts`
Test: `src/server/tools/__tests__/find.test.ts`

- [ ] Step 1: Define interfaces and write failing tests

```typescript
// src/server/tools/find.ts — interfaces only
import type { LoadedData } from '../loader.js';

export interface FindInput {
  query: string;
}

export interface RecipeCard {
  id: string;
  level: string;
  description: string;
  componentNames: string[];  // from sections[type=components].items[].name
  score: number;
}

export interface ComponentCard {
  name: string;
  library: string;
  description: string;
  score: number;
}

export interface DocCard {
  pageTitle: string;
  sectionTitle: string;
  snippet: string;  // max 100 chars
}

export interface FindOutput {
  recipes: RecipeCard[];
  components: ComponentCard[];
  docs: DocCard[];
}

export function handleFind(data: LoadedData, input: FindInput): FindOutput {
  throw new Error('Not implemented');
}

export function formatFind(output: FindOutput): string {
  throw new Error('Not implemented — Chunk 3');
}
```

```typescript
// src/server/tools/__tests__/find.test.ts — key test cases
import { describe, it, expect } from 'vitest';
import { handleFind } from '../find.js';
import MiniSearch from 'minisearch';

// Minimal RecipeDef mock matching Chunk 1 types
function makeRecipe(overrides: Partial<any> & { id: string }) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? 'A test recipe',
    level: overrides.level ?? 'molecule',
    use_cases: overrides.use_cases ?? ['test use case'],
    packages: overrides.packages ?? [],
    tags: overrides.tags ?? ['test'],
    sections: overrides.sections ?? [],
  };
}

function makeComponent(name: string, library: string, description = '') {
  return {
    name, library,
    import_path: `@gravity-ui/${library}`,
    import_statement: `import {${name}} from '@gravity-ui/${library}';`,
    props: [], examples: [], description, source_file: '',
  };
}

function makeChunk(id: string, pageId: string, overrides: Partial<any> = {}) {
  return {
    id, page_id: pageId, url: '', page_title: overrides.page_title ?? 'Test',
    page_type: overrides.page_type ?? 'component', section_title: overrides.section_title ?? 'Section',
    breadcrumbs: [], content: overrides.content ?? 'test content',
    code_examples: [], keywords: overrides.keywords ?? ['test'],
    library: overrides.library,
  };
}

function buildIndex(chunks: any[]) {
  const ms = new MiniSearch({
    fields: ['page_title', 'section_title', 'keywords_joined', 'content'],
    storeFields: ['id'],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  ms.addAll(chunks.map(c => ({
    id: c.id, page_title: c.page_title, section_title: c.section_title,
    keywords_joined: (c.keywords ?? []).join(' '), content: c.content,
  })));
  return ms;
}

function buildTestData(options: { recipes?: any[], components?: any[], chunks?: any[] } = {}) {
  const recipes = options.recipes ?? [];
  const components = options.components ?? [];
  const chunks = options.chunks ?? [];

  const componentByName = new Map<string, any[]>();
  for (const c of components) {
    const list = componentByName.get(c.name) || [];
    list.push(c);
    componentByName.set(c.name, list);
  }

  const pageById = new Map<string, any>();
  const tagsByPageId = new Map<string, string[]>();
  for (const c of components) {
    const pageId = `component:${c.library}:${c.name}`;
    pageById.set(pageId, { id: pageId, title: c.name, library: c.library, description: c.description });
    tagsByPageId.set(pageId, [c.name.toLowerCase()]);
  }

  return {
    recipes,
    recipeById: new Map(recipes.map((r: any) => [r.id, r])),
    componentDefs: components,
    componentByName,
    componentsByLibrary: new Map<string, any[]>(),
    pageById,
    tagsByPageId,
    chunkById: new Map(chunks.map((c: any) => [c.id, c])),
    index: buildIndex(chunks),
    tokens: { spacing: {}, breakpoints: {}, sizes: {} },
    categoryMap: { categories: {}, components: {} },
  } as any;
}

describe('handleFind', () => {
  it('returns empty results for empty query tokens', () => {
    const data = buildTestData();
    const result = handleFind(data, { query: 'the a an' });
    expect(result.recipes).toHaveLength(0);
    expect(result.components).toHaveLength(0);
    expect(result.docs).toHaveLength(0);
  });

  it('matches recipes by use_cases and tags', () => {
    const data = buildTestData({
      recipes: [
        makeRecipe({
          id: 'confirmation-dialog',
          title: 'Confirmation Dialog',
          use_cases: ['confirm destructive action', 'ask user before delete'],
          tags: ['confirm', 'dialog', 'modal', 'delete'],
          sections: [{ type: 'components', items: [{ name: 'Dialog', library: 'uikit', usage: 'required', role: 'overlay' }] }],
        }),
        makeRecipe({
          id: 'data-table',
          title: 'Data Table',
          use_cases: ['display tabular data'],
          tags: ['table', 'data', 'grid'],
        }),
      ],
    });
    const result = handleFind(data, { query: 'confirm delete action' });
    expect(result.recipes.length).toBeGreaterThanOrEqual(1);
    expect(result.recipes[0].id).toBe('confirmation-dialog');
  });

  it('caps recipes at 2', () => {
    const data = buildTestData({
      recipes: Array.from({ length: 5 }, (_, i) => makeRecipe({
        id: `recipe-${i}`,
        use_cases: ['file upload pattern'],
        tags: ['file', 'upload'],
      })),
    });
    const result = handleFind(data, { query: 'file upload' });
    expect(result.recipes.length).toBeLessThanOrEqual(2);
  });

  it('caps components at 3', () => {
    const components = Array.from({ length: 10 }, (_, i) => makeComponent(`Button${i}`, 'uikit', 'clickable button'));
    const data = buildTestData({ components });
    const result = handleFind(data, { query: 'button click' });
    expect(result.components.length).toBeLessThanOrEqual(3);
  });

  it('caps docs at 2', () => {
    const chunks = Array.from({ length: 5 }, (_, i) => makeChunk(
      `chunk-${i}`, `page-${i}`,
      { page_title: `Guide ${i}`, content: 'theming dark mode setup', page_type: 'guide' },
    ));
    const data = buildTestData({ chunks });
    const result = handleFind(data, { query: 'theming dark mode' });
    expect(result.docs.length).toBeLessThanOrEqual(2);
  });

  it('extracts componentNames from recipe sections', () => {
    const data = buildTestData({
      recipes: [makeRecipe({
        id: 'test-recipe',
        use_cases: ['modal confirmation'],
        tags: ['modal'],
        sections: [
          { type: 'components', items: [
            { name: 'Dialog', library: 'uikit', usage: 'required', role: 'overlay' },
            { name: 'Button', library: 'uikit', usage: 'required', role: 'action trigger' },
          ]},
        ],
      })],
    });
    const result = handleFind(data, { query: 'modal confirmation' });
    expect(result.recipes[0].componentNames).toEqual(['Dialog', 'Button']);
  });

  it('truncates doc snippets to 100 chars', () => {
    const longContent = 'x'.repeat(300);
    const chunks = [makeChunk('c1', 'p1', { content: longContent, page_title: 'Guide', page_type: 'guide' })];
    const data = buildTestData({ chunks });
    const result = handleFind(data, { query: 'Guide' });
    if (result.docs.length > 0) {
      expect(result.docs[0].snippet.length).toBeLessThanOrEqual(100);
    }
  });
});
```

Run: `pnpm test -- --run src/server/tools/__tests__/find.test.ts`
Expect: all tests fail (Not implemented).

- [ ] Step 2: Implement recipe scoring in handleFind

Recipe scoring reuses `tokenizeAndClean` and `levenshtein` from `./suggest-component.js`. Scores recipe.use_cases (joined) + recipe.tags against query tokens. Same fuzzy threshold (distance <= 2).

```typescript
// Inside find.ts
import { tokenizeAndClean, levenshtein } from './suggest-component.js';

function scoreRecipe(queryTokens: string[], recipe: RecipeDef): number {
  const recipeTokens = [
    ...recipe.use_cases.flatMap(uc => tokenizeAndClean(uc)),
    ...recipe.tags.flatMap(t => tokenizeAndClean(t)),
  ];
  if (recipeTokens.length === 0) return 0;

  let matchCount = 0;
  for (const qt of queryTokens) {
    for (const rt of recipeTokens) {
      if (rt === qt) { matchCount++; break; }
      if (qt.length >= 4 && rt.length >= 4 && levenshtein(qt, rt) <= 2) {
        matchCount += 0.5; break;
      }
    }
  }
  return matchCount / queryTokens.length;
}

function extractComponentNames(recipe: RecipeDef): string[] {
  for (const section of recipe.sections) {
    if (section.type === 'components') {
      return section.items.map((item: any) => item.name);
    }
  }
  return [];
}
```

- [ ] Step 3: Implement component and doc search, assemble handleFind

Component search: call `handleSuggestComponent(data, { use_case: query, limit: 3 })` and map suggestions to ComponentCard.

Doc search: call `handleSearchDocs(data, { query, limit: 2 })` and map results to DocCard with snippet truncated to 100 chars.

```typescript
import { handleSuggestComponent } from './suggest-component.js';
import { handleSearchDocs, truncateAtWord } from './search-docs.js';
import type { RecipeDef } from '../../types.js'; // Chunk 1 type

export function handleFind(data: LoadedData, input: FindInput): FindOutput {
  const { query } = input;
  const queryTokens = tokenizeAndClean(query);

  // --- Recipes ---
  const recipeScores: { recipe: RecipeDef; score: number }[] = [];
  for (const recipe of data.recipes) {
    const score = scoreRecipe(queryTokens, recipe);
    if (score > 0) recipeScores.push({ recipe, score });
  }
  recipeScores.sort((a, b) => b.score - a.score);
  const recipes: RecipeCard[] = recipeScores.slice(0, 2).map(({ recipe, score }) => ({
    id: recipe.id,
    level: recipe.level,
    description: recipe.description,
    componentNames: extractComponentNames(recipe),
    score: Math.round(score * 100) / 100,
  }));

  // --- Components ---
  const suggestResult = handleSuggestComponent(data, { use_case: query, limit: 3 });
  const components: ComponentCard[] = suggestResult.suggestions.map(s => ({
    name: s.component,
    library: s.library,
    description: s.description,
    score: s.score,
  }));

  // --- Docs ---
  const docsResult = handleSearchDocs(data, { query, limit: 2 });
  const docs: DocCard[] = docsResult.results.map(r => ({
    pageTitle: r.page_title,
    sectionTitle: r.section_title,
    snippet: truncateAtWord(r.snippet, 100),
  }));

  return { recipes, components, docs };
}
```

Run: `pnpm test -- --run src/server/tools/__tests__/find.test.ts`
Expect: all tests pass.

- [ ] Step 4: Add formatFind stub (Chunk 3 placeholder)

```typescript
export function formatFind(output: FindOutput): string {
  // Stub — real formatting in Chunk 3
  const total = output.recipes.length + output.components.length + output.docs.length;
  const lines: string[] = [`${total} results`];
  for (const r of output.recipes) lines.push(`[recipe] ${r.id} (${r.level})`);
  for (const c of output.components) lines.push(`[component] ${c.name} (${c.library})`);
  for (const d of output.docs) lines.push(`[doc] ${d.pageTitle}`);
  return lines.join('\n');
}
```

- [ ] Step 5: Commit

```
git add src/server/tools/find.ts src/server/tools/__tests__/find.test.ts src/server/tools/lib-priority.ts
git commit -m "feat: add find() handler with recipe+component+doc search"
```

---

### Task 7: get() handler

File: `src/server/tools/get.ts`
Test: `src/server/tools/__tests__/get.test.ts`

- [ ] Step 1: Define interfaces and write failing tests

```typescript
// src/server/tools/get.ts — interfaces
import type { LoadedData } from '../loader.js';

export interface GetInput {
  name: string;
  detail?: 'compact' | 'full';
}

export type GetOutputType = 'component' | 'recipe' | 'tokens' | 'library' | 'overview' | 'not_found';

export interface GetOutput {
  type: GetOutputType;
  data: any;
  seeAlso?: string[];  // disambiguation hints
}

export function handleGet(data: LoadedData, input: GetInput): GetOutput {
  throw new Error('Not implemented');
}

export function formatGet(output: GetOutput, detail: 'compact' | 'full'): string {
  throw new Error('Not implemented — Chunk 3');
}
```

```typescript
// src/server/tools/__tests__/get.test.ts — key test cases
import { describe, it, expect } from 'vitest';
import { handleGet } from '../get.js';

function makeComponent(name: string, library: string) {
  return {
    name, library,
    import_path: `@gravity-ui/${library}`,
    import_statement: `import {${name}} from '@gravity-ui/${library}';`,
    props: [{ name: 'size', type: 'string', required: false }],
    examples: ['<' + name + ' />'], description: `${name} component`, source_file: '',
  };
}

function makeRecipe(id: string, overrides: Partial<any> = {}) {
  return {
    id, title: overrides.title ?? id,
    description: overrides.description ?? `Recipe ${id}`,
    level: overrides.level ?? 'molecule',
    use_cases: [], packages: [], tags: [], sections: [],
    ...overrides,
  };
}

function buildTestData(options: {
  components?: any[], recipes?: any[], tokens?: any, overview?: any,
} = {}) {
  const components = options.components ?? [];
  const recipes = options.recipes ?? [];
  const tokens = options.tokens ?? { spacing: { '1': '4px' }, breakpoints: { s: 576 }, sizes: { m: '28px' } };

  const componentByName = new Map<string, any[]>();
  for (const c of components) {
    const list = componentByName.get(c.name) || [];
    list.push(c);
    componentByName.set(c.name, list);
  }

  const overview = options.overview ?? {
    system: { description: 'Gravity UI', theming: 'dark/light', spacing: '4px grid', typography: 'scales', corner_radius: '4px', branding: 'Gravity' },
    libraries: [{ id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core components', component_count: 50, depends_on: [], is_peer_dependency_of: ['components'] }],
  };

  return {
    componentDefs: components,
    componentByName,
    componentsByLibrary: new Map<string, any[]>(),
    recipes,
    recipeById: new Map(recipes.map((r: any) => [r.id, r])),
    tokens,
    overview,
    pageById: new Map(),
    tagsByPageId: new Map(),
    chunkById: new Map(),
    index: { search: () => [] } as any,
    categoryMap: { categories: {}, components: {} },
  } as any;
}

describe('handleGet — routing priority', () => {
  // Priority 1: token topics
  it('routes "spacing" to tokens', () => {
    const result = handleGet(buildTestData(), { name: 'spacing' });
    expect(result.type).toBe('tokens');
    expect(result.data.spacing).toBeDefined();
  });

  it('routes "breakpoints" to tokens', () => {
    const result = handleGet(buildTestData(), { name: 'breakpoints' });
    expect(result.type).toBe('tokens');
  });

  it('routes "colors" to tokens', () => {
    const data = buildTestData({ tokens: { spacing: {}, breakpoints: {}, sizes: {}, colors: { primary: '#000' } } });
    const result = handleGet(data, { name: 'colors' });
    expect(result.type).toBe('tokens');
  });

  it('routes "typography" to tokens', () => {
    const data = buildTestData({ tokens: { spacing: {}, breakpoints: {}, sizes: {}, typography: { body: '14px' } } });
    const result = handleGet(data, { name: 'typography' });
    expect(result.type).toBe('tokens');
  });

  it('routes "sizes" to tokens', () => {
    const result = handleGet(buildTestData(), { name: 'sizes' });
    expect(result.type).toBe('tokens');
  });

  // Priority 2: overview
  it('routes "overview" to overview', () => {
    const result = handleGet(buildTestData(), { name: 'overview' });
    expect(result.type).toBe('overview');
    expect(result.data.system).toBeDefined();
  });

  // Priority 3: component by PascalCase name
  it('routes PascalCase name to component', () => {
    const data = buildTestData({ components: [makeComponent('Button', 'uikit')] });
    const result = handleGet(data, { name: 'Button' });
    expect(result.type).toBe('component');
    expect(result.data.name).toBe('Button');
  });

  it('prefers uikit when component exists in multiple libraries', () => {
    const data = buildTestData({
      components: [
        makeComponent('Label', 'components'),
        makeComponent('Label', 'uikit'),
      ],
    });
    const result = handleGet(data, { name: 'Label' });
    expect(result.type).toBe('component');
    expect(result.data.library).toBe('uikit');
    expect(result.seeAlso).toBeDefined();
    expect(result.seeAlso!.some((s: string) => s.includes('components'))).toBe(true);
  });

  // Priority 4: recipe by kebab-case ID
  it('routes kebab-case ID to recipe', () => {
    const data = buildTestData({ recipes: [makeRecipe('confirmation-dialog')] });
    const result = handleGet(data, { name: 'confirmation-dialog' });
    expect(result.type).toBe('recipe');
    expect(result.data.id).toBe('confirmation-dialog');
  });

  it('matches recipe by prefix', () => {
    const data = buildTestData({ recipes: [makeRecipe('data-table-with-filters')] });
    const result = handleGet(data, { name: 'data-table' });
    expect(result.type).toBe('recipe');
    expect(result.data.id).toBe('data-table-with-filters');
  });

  it('does not prefix-match when multiple recipes match', () => {
    const data = buildTestData({
      recipes: [makeRecipe('data-table-basic'), makeRecipe('data-table-advanced')],
    });
    const result = handleGet(data, { name: 'data-table' });
    // Should NOT match via prefix since ambiguous — falls through to fuzzy or not_found
    expect(result.type).not.toBe('recipe');
  });

  // Priority 5: library ID
  it('routes library ID to library', () => {
    const result = handleGet(buildTestData(), { name: 'uikit' });
    expect(result.type).toBe('library');
    expect(result.data.id).toBe('uikit');
  });

  // Priority 6: not found
  it('returns not_found with suggestions for unknown name', () => {
    const data = buildTestData({ components: [makeComponent('Button', 'uikit')] });
    const result = handleGet(data, { name: 'Buttn' });
    expect(result.type).toBe('not_found');
  });

  // Case insensitivity
  it('matches component name case-insensitively', () => {
    const data = buildTestData({ components: [makeComponent('Button', 'uikit')] });
    const result = handleGet(data, { name: 'button' });
    expect(result.type).toBe('component');
  });
});
```

Run: `pnpm test -- --run src/server/tools/__tests__/get.test.ts`
Expect: all tests fail.

- [ ] Step 2: Implement routing logic (priorities 1-2: tokens + overview)

```typescript
import type { LoadedData } from '../loader.js';
import type { TokenSet } from '../../types.js';

const TOKEN_TOPICS = new Set(['spacing', 'breakpoints', 'sizes', 'colors', 'typography']);

export function handleGet(data: LoadedData, input: GetInput): GetOutput {
  const { name } = input;
  const nameLower = name.toLowerCase();

  // Priority 1: token topic
  if (TOKEN_TOPICS.has(nameLower)) {
    return {
      type: 'tokens',
      data: { [nameLower]: (data.tokens as Record<string, unknown>)[nameLower] },
    };
  }

  // Priority 2: overview
  if (nameLower === 'overview') {
    return { type: 'overview', data: data.overview };
  }

  // ... priorities 3-6 in Step 3
  return { type: 'not_found', data: { name } };
}
```

- [ ] Step 3: Implement routing priorities 3-5 (component, recipe, library)

```typescript
import { LIBRARY_PRIORITY, pickByLibraryPriority } from './lib-priority.js';

// Inside handleGet, after priority 2:

  // Priority 3: exact component match (PascalCase, case-insensitive)
  let componentCandidates = data.componentByName.get(name) ?? [];
  if (componentCandidates.length === 0) {
    for (const [key, vals] of data.componentByName) {
      if (key.toLowerCase() === nameLower) {
        componentCandidates = vals;
        break;
      }
    }
  }
  if (componentCandidates.length > 0) {
    const picked = pickByLibraryPriority(componentCandidates);
    const seeAlso = componentCandidates.length > 1
      ? componentCandidates
          .filter(c => c !== picked)
          .map(c => `${c.name} (${c.library})`)
      : undefined;
    return { type: 'component', data: picked, seeAlso };
  }

  // Priority 4: exact recipe match, then prefix match
  const exactRecipe = data.recipeById.get(nameLower) ?? data.recipeById.get(name);
  if (exactRecipe) {
    return { type: 'recipe', data: exactRecipe };
  }
  // Prefix match: only if exactly one recipe starts with the query
  const prefixMatches = data.recipes.filter(r => r.id.startsWith(nameLower));
  if (prefixMatches.length === 1) {
    return { type: 'recipe', data: prefixMatches[0] };
  }

  // Priority 5: library ID
  const lib = data.overview.libraries.find(
    (l: any) => l.id === nameLower || l.id === name,
  );
  if (lib) {
    return { type: 'library', data: lib };
  }
```

- [ ] Step 4: Implement priority 6 (fuzzy fallback + not_found)

Fuzzy search: use `handleSuggestComponent` with `use_case: name, limit: 1`. If score > 0.1, return that component with seeAlso hints. Otherwise return not_found with similar name suggestions via levenshtein on component names.

```typescript
import { handleSuggestComponent, tokenizeAndClean, levenshtein } from './suggest-component.js';

  // Priority 6: fuzzy fallback
  const fuzzy = handleSuggestComponent(data, { use_case: name, limit: 3 });
  if (fuzzy.suggestions.length > 0 && fuzzy.suggestions[0].score > 0.1) {
    const best = fuzzy.suggestions[0];
    const comp = data.componentByName.get(best.component)?.[0];
    if (comp) {
      const seeAlso = fuzzy.suggestions.slice(1).map(s => `${s.component} (${s.library})`);
      return { type: 'component', data: comp, seeAlso };
    }
  }

  // Not found — gather suggestions
  const suggestions: string[] = [];
  for (const [compName] of data.componentByName) {
    if (levenshtein(compName.toLowerCase(), nameLower) <= 3) {
      suggestions.push(compName);
    }
  }
  for (const recipe of data.recipes) {
    if (levenshtein(recipe.id, nameLower) <= 3) {
      suggestions.push(recipe.id);
    }
  }

  return {
    type: 'not_found',
    data: { name, suggestions: suggestions.slice(0, 5) },
  };
```

Run: `pnpm test -- --run src/server/tools/__tests__/get.test.ts`
Expect: all tests pass.

- [ ] Step 5: Add formatGet stub and commit

```typescript
export function formatGet(output: GetOutput, detail: 'compact' | 'full' = 'compact'): string {
  // Stub — full formatting in Chunk 3
  // Chunk 3 will import and delegate to:
  //   formatGetComponent (from get-component.ts) for type=component
  //   formatGetDesignTokens (from get-design-tokens.ts) for type=tokens
  //   formatRecipe (new) for type=recipe
  //   formatLibrary (new) for type=library
  //   formatOverview (new) for type=overview
  if (output.type === 'not_found') {
    const d = output.data;
    const similar = d.suggestions?.length > 0 ? ` Similar: ${d.suggestions.join(', ')}` : '';
    return `'${d.name}' not found.${similar} Try find('${d.name}') for broader search.`;
  }
  return `[${output.type}] ${JSON.stringify(output.data).slice(0, 200)}`;
}
```

```
git add src/server/tools/get.ts src/server/tools/__tests__/get.test.ts
git commit -m "feat: add get() handler with 6-level routing priority"
```

---

### Task 8: list() handler

File: `src/server/tools/list.ts`
Test: `src/server/tools/__tests__/list.test.ts`

- [ ] Step 1: Define interfaces and write failing tests

```typescript
// src/server/tools/list.ts — interfaces
import type { LoadedData } from '../loader.js';

export interface ListInput {
  what?: 'components' | 'recipes' | 'libraries' | 'tokens';
  filter?: string;
}

export interface TableOfContents {
  kind: 'toc';
  componentCount: number;
  libraryCount: number;
  categories: string[];
  recipeCount: number;
  tokenTopics: string[];
}

export interface RecipeListItem {
  id: string;
  description: string;
}

export interface RecipeListOutput {
  kind: 'recipes';
  byLevel: Record<string, RecipeListItem[]>;  // foundation | molecule | organism
  totalCount: number;
}

export interface LibraryListItem {
  id: string;
  package: string;
  componentCount: number;
  purpose: string;
}

export interface LibraryListOutput {
  kind: 'libraries';
  libraries: LibraryListItem[];
}

export interface TokenListItem {
  topic: string;
  count: number;
  hint: string;
}

export interface TokenListOutput {
  kind: 'tokens';
  topics: TokenListItem[];
}

export interface ErrorOutput {
  kind: 'error';
  message: string;
}

// Reuse ListComponentsOutput from list-components.ts for components
import type { ListComponentsOutput } from './list-components.js';

export interface ComponentsListOutput extends ListComponentsOutput {
  kind: 'components';
}

export type ListOutput = TableOfContents | RecipeListOutput | LibraryListOutput | TokenListOutput | (ComponentsListOutput) | ErrorOutput;

export function handleList(data: LoadedData, input: ListInput): ListOutput {
  throw new Error('Not implemented');
}

export function formatList(output: ListOutput): string {
  throw new Error('Not implemented — Chunk 3');
}
```

```typescript
// src/server/tools/__tests__/list.test.ts
import { describe, it, expect } from 'vitest';
import { handleList } from '../list.js';

function makeComponent(name: string, library: string) {
  return {
    name, library, import_path: `@gravity-ui/${library}`,
    import_statement: '', props: [], examples: [], description: '', source_file: '',
  };
}

function makeRecipe(id: string, level: string) {
  return {
    id, title: id, description: `Recipe ${id}`, level,
    use_cases: [], packages: [], tags: [], sections: [],
  };
}

function buildTestData(options: { components?: any[], recipes?: any[], tokens?: any, overview?: any } = {}) {
  const components = options.components ?? [
    makeComponent('Button', 'uikit'),
    makeComponent('TextInput', 'uikit'),
  ];
  const recipes = options.recipes ?? [];
  const tokens = options.tokens ?? {
    spacing: { '1': '4px', '2': '8px' },
    breakpoints: { s: 576, m: 768 },
    sizes: { m: '28px' },
    colors: { primary: '#000', secondary: '#fff' },
    typography: { body: '14px' },
  };
  const overview = options.overview ?? {
    system: { description: 'GravityUI', theming: 'themes', spacing: '4px', typography: 'scales', corner_radius: '4px', branding: 'Gravity' },
    libraries: [
      { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core UI components', component_count: 50, depends_on: [], is_peer_dependency_of: [] },
      { id: 'components', package: '@gravity-ui/components', purpose: 'Higher-level components', component_count: 20, depends_on: ['uikit'], is_peer_dependency_of: [] },
    ],
  };

  const componentsByLibrary = new Map<string, any[]>();
  for (const c of components) {
    const list = componentsByLibrary.get(c.library) || [];
    list.push(c);
    componentsByLibrary.set(c.library, list);
  }

  return {
    componentDefs: components,
    componentsByLibrary,
    componentByName: new Map<string, any[]>(),
    recipes,
    recipeById: new Map(recipes.map((r: any) => [r.id, r])),
    tokens,
    overview,
    categoryMap: {
      categories: { actions: 'Actions', forms: 'Form Controls' },
      components: { Button: 'actions', TextInput: 'forms' },
    },
    pageById: new Map(), tagsByPageId: new Map(), chunkById: new Map(),
    index: { search: () => [] } as any,
  } as any;
}

describe('handleList — table of contents (no args)', () => {
  it('returns toc with counts', () => {
    const data = buildTestData({
      recipes: [makeRecipe('r1', 'molecule'), makeRecipe('r2', 'organism')],
    });
    const result = handleList(data, {});
    expect(result.kind).toBe('toc');
    if (result.kind === 'toc') {
      expect(result.componentCount).toBe(2);
      expect(result.libraryCount).toBe(2);
      expect(result.recipeCount).toBe(2);
      expect(result.tokenTopics).toContain('spacing');
      expect(result.categories.length).toBeGreaterThan(0);
    }
  });
});

describe('handleList — components', () => {
  it('returns grouped components', () => {
    const result = handleList(buildTestData(), { what: 'components' });
    expect(result.kind).toBe('components');
  });

  it('filters by category slug', () => {
    const result = handleList(buildTestData(), { what: 'components', filter: 'actions' });
    expect(result.kind).toBe('components');
    if (result.kind === 'components') {
      expect(result.totalCount).toBe(1);
      expect(result.groups[0].components[0].name).toBe('Button');
    }
  });

  it('filters by library ID', () => {
    const data = buildTestData({
      components: [
        makeComponent('Button', 'uikit'),
        makeComponent('AsideHeader', 'navigation'),
      ],
    });
    const result = handleList(data, { what: 'components', filter: 'uikit' });
    expect(result.kind).toBe('components');
    if (result.kind === 'components') {
      expect(result.totalCount).toBe(1);
    }
  });
});

describe('handleList — recipes', () => {
  it('groups by level', () => {
    const data = buildTestData({
      recipes: [
        makeRecipe('theming', 'foundation'),
        makeRecipe('dialog', 'molecule'),
        makeRecipe('table', 'organism'),
      ],
    });
    const result = handleList(data, { what: 'recipes' });
    expect(result.kind).toBe('recipes');
    if (result.kind === 'recipes') {
      expect(result.byLevel.foundation).toHaveLength(1);
      expect(result.byLevel.molecule).toHaveLength(1);
      expect(result.byLevel.organism).toHaveLength(1);
      expect(result.totalCount).toBe(3);
    }
  });

  it('filters by level', () => {
    const data = buildTestData({
      recipes: [
        makeRecipe('theming', 'foundation'),
        makeRecipe('dialog', 'molecule'),
      ],
    });
    const result = handleList(data, { what: 'recipes', filter: 'molecule' });
    expect(result.kind).toBe('recipes');
    if (result.kind === 'recipes') {
      expect(result.totalCount).toBe(1);
      expect(result.byLevel.molecule).toHaveLength(1);
      expect(result.byLevel.foundation).toBeUndefined();
    }
  });
});

describe('handleList — libraries', () => {
  it('returns library list from overview', () => {
    const result = handleList(buildTestData(), { what: 'libraries' });
    expect(result.kind).toBe('libraries');
    if (result.kind === 'libraries') {
      expect(result.libraries).toHaveLength(2);
      expect(result.libraries[0].id).toBe('uikit');
    }
  });
});

describe('handleList — tokens', () => {
  it('returns topic list with counts', () => {
    const result = handleList(buildTestData(), { what: 'tokens' });
    expect(result.kind).toBe('tokens');
    if (result.kind === 'tokens') {
      expect(result.topics.length).toBeGreaterThanOrEqual(4);
      const spacing = result.topics.find(t => t.topic === 'spacing');
      expect(spacing).toBeDefined();
      expect(spacing!.count).toBe(2);
    }
  });
});

describe('handleList — error handling', () => {
  it('returns error for invalid what value', () => {
    const result = handleList(buildTestData(), { what: 'invalid' as any });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('invalid');
    }
  });
});
```

Run: `pnpm test -- --run src/server/tools/__tests__/list.test.ts`
Expect: all tests fail.

- [ ] Step 2: Implement TOC and components branches

```typescript
import { handleListComponents } from './list-components.js';
import type { ListComponentsOutput } from './list-components.js';

const VALID_WHATS = new Set(['components', 'recipes', 'libraries', 'tokens']);

export function handleList(data: LoadedData, input: ListInput): ListOutput {
  const { what, filter } = input;

  // No args -> table of contents
  if (!what) {
    const tokenTopics = Object.keys(data.tokens).filter(
      k => data.tokens[k as keyof typeof data.tokens] != null,
    );
    return {
      kind: 'toc',
      componentCount: data.componentDefs.length,
      libraryCount: data.overview.libraries.length,
      categories: Object.keys(data.categoryMap.categories),
      recipeCount: data.recipes.length,
      tokenTopics,
    };
  }

  if (!VALID_WHATS.has(what)) {
    return {
      kind: 'error',
      message: `'${what}' is not valid. Use: components, recipes, libraries, tokens.`,
    };
  }

  if (what === 'components') {
    // Detect if filter is a library ID or category slug
    const isLibrary = data.componentsByLibrary.has(filter ?? '');
    const listInput = isLibrary
      ? { library: filter }
      : { category: filter };
    const result = handleListComponents(data, filter ? listInput : {});
    return { ...result, kind: 'components' as const };
  }

  // ... recipes, libraries, tokens in Step 3
  return { kind: 'error', message: 'Not yet implemented' };
}
```

- [ ] Step 3: Implement recipes, libraries, tokens branches

```typescript
  if (what === 'recipes') {
    let filtered = data.recipes;
    if (filter) {
      filtered = data.recipes.filter((r: any) => r.level === filter);
    }
    const byLevel: Record<string, RecipeListItem[]> = {};
    for (const recipe of filtered) {
      if (!byLevel[recipe.level]) byLevel[recipe.level] = [];
      byLevel[recipe.level].push({ id: recipe.id, description: recipe.description });
    }
    return { kind: 'recipes', byLevel, totalCount: filtered.length };
  }

  if (what === 'libraries') {
    return {
      kind: 'libraries',
      libraries: data.overview.libraries.map((lib: any) => ({
        id: lib.id,
        package: lib.package,
        componentCount: lib.component_count,
        purpose: lib.purpose,
      })),
    };
  }

  if (what === 'tokens') {
    const TOKEN_HINTS: Record<string, string> = {
      spacing: '4px grid',
      breakpoints: 'responsive breakpoints',
      sizes: 'component heights',
      colors: 'semantic color tokens',
      typography: 'named type scales',
    };
    const topics: TokenListItem[] = [];
    for (const [key, value] of Object.entries(data.tokens)) {
      if (value != null && typeof value === 'object') {
        topics.push({
          topic: key,
          count: Object.keys(value).length,
          hint: TOKEN_HINTS[key] ?? key,
        });
      }
    }
    return { kind: 'tokens', topics };
  }
```

Run: `pnpm test -- --run src/server/tools/__tests__/list.test.ts`
Expect: all tests pass.

- [ ] Step 4: Add formatList stub and commit

```typescript
export function formatList(output: ListOutput): string {
  // Stub — full formatting in Chunk 3
  if (output.kind === 'error') return output.message;
  if (output.kind === 'toc') {
    return [
      `Components: ${output.componentCount} in ${output.libraryCount} libraries`,
      `  Categories: ${output.categories.join(', ')}`,
      `Recipes: ${output.recipeCount} patterns`,
      `  Levels: foundation, molecule, organism`,
      `Libraries: ${output.libraryCount} packages`,
      `Tokens: ${output.tokenTopics.join(', ')}`,
    ].join('\n');
  }
  return `[${output.kind}] ${JSON.stringify(output).slice(0, 300)}`;
}
```

```
git add src/server/tools/list.ts src/server/tools/__tests__/list.test.ts
git commit -m "feat: add list() handler with TOC, components, recipes, libraries, tokens"
```

- [ ] Step 5: Final integration — run all tests together

```
pnpm test -- --run src/server/tools/__tests__/find.test.ts src/server/tools/__tests__/get.test.ts src/server/tools/__tests__/list.test.ts
```

Verify no import cycles. All three handlers only depend on:
- `../loader.js` (LoadedData type)
- `../../types.js` (RecipeDef, TokenSet, etc.)
- `./suggest-component.js` (tokenizeAndClean, levenshtein, handleSuggestComponent)
- `./search-docs.js` (handleSearchDocs, truncateAtWord)
- `./list-components.js` (handleListComponents, ListComponentsOutput)
- `./lib-priority.js` (LIBRARY_PRIORITY, pickByLibraryPriority)

No handler imports another new handler. No circular dependencies.

---

### File inventory

New files (this chunk):
- `src/server/tools/lib-priority.ts` — shared library priority constant + picker
- `src/server/tools/find.ts` — handleFind, formatFind (stub), interfaces
- `src/server/tools/get.ts` — handleGet, formatGet (stub), interfaces
- `src/server/tools/list.ts` — handleList, formatList (stub), interfaces
- `src/server/tools/__tests__/find.test.ts`
- `src/server/tools/__tests__/get.test.ts`
- `src/server/tools/__tests__/list.test.ts`

Modified files (none in this chunk):
- Chunk 1 already extends `src/types.ts` (RecipeDef) and `src/server/loader.ts` (LoadedData)

Deferred to next chunks:
- Chunk 3: Full formatFind, formatGet, formatList, formatRecipe, formatLibrary, formatOverview
- Chunk 4: Server wiring (replace 5 tools with 3 in server.ts), version bump
- Chunk 5: Recipe data creation (data/recipes.json), validation, search index update

---

## Chunk 3: Formatters, Server Wiring, Smoke Tests, and Cleanup

Depends on: Chunk 2 (find/get/list handlers with stub formatters)

This chunk replaces the stub formatters with full implementations, rewires server.ts to expose the 3 new tools (removing the 5 old ones), updates the smoke test to cover all new tool paths, and removes obsolete files.

Conventions inherited from existing formatters:
- All output is plain text (no markdown except code fences for code examples)
- Use `sanitize()` from `../format.js` to strip markdown
- Use `indent()` from `../format.js` for nested content
- Use `codeBlock()` from `../format.js` for code examples
- Use `truncateAtWord()` from `./search-docs.js` for snippets
- Reuse `formatGetComponent()` from `./get-component.js` for component output
- Reuse `formatGetDesignTokens()` from `./get-design-tokens.js` for token output
- Reuse `formatListComponents()` from `./list-components.js` for component lists

---

### Task 9: Formatters

Files: `src/server/tools/find.ts`, `src/server/tools/get.ts`, `src/server/tools/list.ts`

- [ ] Step 1: Implement formatFind (replace stub in find.ts)

```typescript
// src/server/tools/find.ts — replace formatFind stub

export function formatFind(output: FindOutput): string {
  const total = output.recipes.length + output.components.length + output.docs.length;
  if (total === 0) {
    return 'No matches. Try list() to browse available components and recipes.';
  }

  const lines: string[] = [`${total} results`];
  lines.push('');

  for (const r of output.recipes) {
    lines.push(`[recipe] ${r.id} (${r.level})`);
    lines.push(`   ${r.description}`);
    if (r.componentNames.length > 0) {
      lines.push(`   Components: ${r.componentNames.join(', ')}`);
    }
    lines.push('');
  }

  for (const c of output.components) {
    lines.push(`[component] ${c.name} (${c.library}) ${c.score}`);
    lines.push(`   ${c.description}`);
    lines.push('');
  }

  for (const d of output.docs) {
    lines.push(`[doc] ${d.pageTitle} — ${d.sectionTitle}`);
    lines.push(`   ${d.snippet}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}
```

- [ ] Step 2: Implement formatGet (replace stub in get.ts) with formatRecipe, formatLibrary, formatOverview

```typescript
// src/server/tools/get.ts — replace formatGet stub

import { formatGetComponent } from './get-component.js';
import { formatGetDesignTokens } from './get-design-tokens.js';
import { codeBlock, indent } from '../format.js';

function formatRecipe(recipe: any, detail: 'compact' | 'full'): string {
  const lines: string[] = [];

  // Header
  lines.push(`${recipe.title} (${recipe.level})`);
  lines.push(recipe.description);
  lines.push('');

  // Decision section
  const decision = recipe.sections.find((s: any) => s.type === 'decision');
  if (decision) {
    lines.push(`When: ${decision.when}`);
    lines.push(`Not for: ${decision.not_for}`);
    lines.push('');
  }

  // Components section
  const components = recipe.sections.find((s: any) => s.type === 'components');
  if (components) {
    lines.push('Components:');
    for (const item of components.items) {
      lines.push(`   ${item.name} (${item.library}) [${item.usage}] — ${item.role}`);
    }
    lines.push('');
  }

  // Packages
  if (recipe.packages.length > 0) {
    lines.push(`Install: ${recipe.packages.join(' ')}`);
    lines.push('');
  }

  // Full detail: structure, matrix, examples, avoid, related
  if (detail === 'full') {
    // Decision matrix
    if (decision?.matrix) {
      lines.push('Decision matrix:');
      for (const row of decision.matrix) {
        lines.push(`   ${row.situation} -> ${row.component} — ${row.why}`);
      }
      lines.push('');
    }

    // Setup
    const setup = recipe.sections.find((s: any) => s.type === 'setup');
    if (setup) {
      lines.push('Setup:');
      for (const step of setup.steps) {
        lines.push(`   ${step}`);
      }
      lines.push('');
    }

    // Custom parts
    const customParts = recipe.sections.find((s: any) => s.type === 'custom_parts');
    if (customParts) {
      lines.push('Custom parts:');
      for (const item of customParts.items) {
        lines.push(`   ${item.name} — ${item.description}`);
        lines.push(`      Approach: ${item.approach}`);
      }
      lines.push('');
    }

    // Structure
    const structure = recipe.sections.find((s: any) => s.type === 'structure');
    if (structure) {
      if (structure.tree) {
        lines.push('Structure:');
        for (const line of structure.tree) {
          lines.push(`   ${line}`);
        }
        lines.push('');
      }
      if (structure.flow) {
        lines.push('Flow:');
        for (const line of structure.flow) {
          lines.push(`   ${line}`);
        }
        lines.push('');
      }
    }

    // Examples
    const examples = recipe.sections.filter((s: any) => s.type === 'example');
    for (const example of examples) {
      lines.push(`Example: ${example.title}`);
      lines.push(codeBlock('tsx', example.code));
      lines.push('');
    }

    // Avoid
    const avoid = recipe.sections.find((s: any) => s.type === 'avoid');
    if (avoid) {
      lines.push('Avoid:');
      for (const item of avoid.items) {
        lines.push(`   ${item}`);
      }
      lines.push('');
    }

    // Related
    const related = recipe.sections.find((s: any) => s.type === 'related');
    if (related) {
      lines.push('Related:');
      for (const item of related.items) {
        lines.push(`   ${item.id} — ${item.note}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

function formatLibrary(lib: any): string {
  const lines: string[] = [];
  lines.push(`${lib.id} (@${lib.package})`);
  lines.push(lib.purpose);
  lines.push(`${lib.component_count} components`);
  if (lib.depends_on?.length > 0) {
    lines.push(`Depends on: ${lib.depends_on.join(', ')}`);
  }
  if (lib.is_peer_dependency_of?.length > 0) {
    lines.push(`Used by: ${lib.is_peer_dependency_of.join(', ')}`);
  }
  return lines.join('\n');
}

function formatOverview(overview: any): string {
  const lines: string[] = [];
  const sys = overview.system;
  lines.push('Gravity UI Design System');
  lines.push(sys.description);
  lines.push('');
  lines.push(`Theming: ${sys.theming}`);
  lines.push(`Spacing: ${sys.spacing}`);
  lines.push(`Typography: ${sys.typography}`);
  lines.push(`Corner radius: ${sys.corner_radius}`);
  lines.push(`Branding: ${sys.branding}`);
  lines.push('');
  const libIds = overview.libraries.map((l: any) => l.id);
  lines.push(`${overview.libraries.length} libraries: ${libIds.join(', ')}`);
  return lines.join('\n');
}

export function formatGet(output: GetOutput, detail: 'compact' | 'full' = 'compact'): string {
  if (output.type === 'not_found') {
    const d = output.data;
    const similar = d.suggestions?.length > 0 ? ` Similar: ${d.suggestions.join(', ')}` : '';
    return `'${d.name}' not found.${similar} Try find('${d.name}') for broader search.`;
  }

  let text = '';

  switch (output.type) {
    case 'component':
      text = formatGetComponent({ component: output.data }, detail);
      break;
    case 'recipe':
      text = formatRecipe(output.data, detail);
      break;
    case 'tokens':
      text = formatGetDesignTokens(output.data);
      break;
    case 'library':
      text = formatLibrary(output.data);
      break;
    case 'overview':
      text = formatOverview(output.data);
      break;
  }

  if (output.seeAlso && output.seeAlso.length > 0) {
    text += `\n\nSee also: ${output.seeAlso.join(', ')}`;
  }

  return text;
}
```

- [ ] Step 3: Implement formatList (replace stub in list.ts) with formatTableOfContents, formatRecipeList, formatLibraryList, formatTokenList

```typescript
// src/server/tools/list.ts — replace formatList stub

import { formatListComponents } from './list-components.js';

function formatTableOfContents(output: TableOfContents): string {
  return [
    `Components: ${output.componentCount} in ${output.libraryCount} libraries`,
    `  Categories: ${output.categories.join(', ')}`,
    `Recipes: ${output.recipeCount} patterns`,
    `  Levels: foundation, molecule, organism`,
    `Libraries: ${output.libraryCount} packages`,
    `Tokens: ${output.tokenTopics.join(', ')}`,
  ].join('\n');
}

function formatRecipeList(output: RecipeListOutput): string {
  const lines: string[] = [`${output.totalCount} recipes`];
  lines.push('');

  const levelOrder = ['foundation', 'molecule', 'organism'];
  for (const level of levelOrder) {
    const items = output.byLevel[level];
    if (!items || items.length === 0) continue;
    lines.push(level);
    for (const item of items) {
      lines.push(`  ${item.id} — ${item.description}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function formatLibraryList(output: LibraryListOutput): string {
  const lines: string[] = [`${output.libraries.length} libraries`];
  lines.push('');

  for (const lib of output.libraries) {
    lines.push(`${lib.id} (${lib.package}) — ${lib.componentCount} components`);
    lines.push(`  ${lib.purpose}`);
  }

  return lines.join('\n').trim();
}

function formatTokenList(output: TokenListOutput): string {
  const lines: string[] = [`${output.topics.length} token topics`];
  lines.push('');

  for (const topic of output.topics) {
    lines.push(`${topic.topic} — ${topic.hint}, ${topic.count} values`);
  }

  return lines.join('\n').trim();
}

export function formatList(output: ListOutput): string {
  switch (output.kind) {
    case 'error':
      return output.message;
    case 'toc':
      return formatTableOfContents(output);
    case 'components':
      return formatListComponents(output);
    case 'recipes':
      return formatRecipeList(output);
    case 'libraries':
      return formatLibraryList(output);
    case 'tokens':
      return formatTokenList(output);
  }
}
```

- [ ] Step 4: Run all handler tests to verify formatters don't break anything

```
pnpm test -- --run src/server/tools/__tests__/find.test.ts src/server/tools/__tests__/get.test.ts src/server/tools/__tests__/list.test.ts
```

Expect: all tests pass.

- [ ] Step 5: Commit

```
git add src/server/tools/find.ts src/server/tools/get.ts src/server/tools/list.ts
git commit -m "feat: implement full formatters for find/get/list tools"
```

---

### Task 10: Rewire server.ts

File: `src/server/server.ts`

- [ ] Step 1: Remove 5 old tool registrations, add 3 new ones, bump version

Replace the entire server.ts tool section. Remove imports for old handlers and add imports for new ones. Bump version from `0.2.0` to `1.0.0`.

```typescript
// src/server/server.ts — full replacement
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadData } from "./loader.js";
import { handleFind, formatFind } from "./tools/find.js";
import { handleGet, formatGet } from "./tools/get.js";
import { handleList, formatList } from "./tools/list.js";

const data = loadData();
console.error(`Loaded: ${data.pages.length} pages, ${data.chunks.length} chunks, ${data.componentDefs.length} components, ${data.recipes.length} recipes`);

const server = new McpServer({ name: "gravityui-docs", version: "1.0.0" });

// Tool 1: find
server.tool(
  "find",
  "Find the right Gravity UI components, patterns, or recipes for your use case. Describe what you need in plain language. Returns compact cards you can expand with get().",
  {
    query: z.string().describe("Describe what you need, e.g. 'confirmation dialog before delete' or 'table with sorting and pagination'"),
  },
  (args) => {
    const result = handleFind(data, args);
    return { content: [{ type: "text", text: formatFind(result) }] };
  },
);

// Tool 2: get
server.tool(
  "get",
  "Get full details for a component, recipe, token topic, or library by name. Use component names like 'Button', recipe IDs like 'confirmation-dialog', token topics like 'spacing', or 'overview' for the design system summary.",
  {
    name: z.string().describe("Component name (e.g. 'Button'), recipe ID (e.g. 'confirmation-dialog'), token topic (e.g. 'spacing'), library ID (e.g. 'uikit'), or 'overview'"),
    detail: z.enum(["compact", "full"]).optional().describe("'compact' (default): summary. 'full': all sections, examples, and props"),
  },
  (args) => {
    const result = handleGet(data, args);
    return { content: [{ type: "text", text: formatGet(result, args.detail) }] };
  },
);

// Tool 3: list
server.tool(
  "list",
  "Browse what Gravity UI offers. No arguments returns a table of contents. Filter by type: 'components', 'recipes', 'libraries', 'tokens'. Add a second argument to narrow: list('components', 'forms') or list('recipes', 'organism').",
  {
    what: z.enum(["components", "recipes", "libraries", "tokens"]).optional().describe("What to list. Omit for table of contents."),
    filter: z.string().optional().describe("Narrow results: category slug for components, library ID for components, level for recipes"),
  },
  (args) => {
    const result = handleList(data, args);
    return { content: [{ type: "text", text: formatList(result) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] Step 2: Verify build

```
pnpm build
```

Expect: no TypeScript errors.

- [ ] Step 3: Commit

```
git add src/server/server.ts
git commit -m "feat: rewire server.ts with 3 intent-based tools, bump to 1.0.0"
```

---

### Task 11: Update smoke tests

File: `src/server/smoke-test.ts`

- [ ] Step 1: Replace entire smoke test with 12 new test cases

```typescript
// src/server/smoke-test.ts — full replacement
/**
 * Smoke test for all MCP tools (v1.0.0: find/get/list).
 * Run: pnpm build && npx tsx src/server/smoke-test.ts
 */

const ROOT = new URL("../../dist/", import.meta.url).pathname;

const { loadData } = await import(`${ROOT}server/loader.js`);
const { handleFind, formatFind } = await import(`${ROOT}server/tools/find.js`);
const { handleGet, formatGet } = await import(`${ROOT}server/tools/get.js`);
const { handleList, formatList } = await import(`${ROOT}server/tools/list.js`);

const data = loadData();
console.log(`Loaded: ${data.pages.length} pages, ${data.chunks.length} chunks, ${data.componentDefs.length} components, ${data.recipes.length} recipes\n`);

interface TestCase {
  name: string;
  run: () => string;
  check: (output: string) => { pass: boolean; reason: string };
}

const tests: TestCase[] = [
  // --- 1. find("confirmation dialog") ---
  {
    name: 'find — "confirmation dialog"',
    run: () => formatFind(handleFind(data, { query: "confirmation dialog" })),
    check: (out: string) => {
      const hasRecipe = out.includes('[recipe]');
      const hasComponent = out.includes('[component]');
      return {
        pass: hasRecipe || hasComponent,
        reason: `recipe=${hasRecipe}, component=${hasComponent}`,
      };
    },
  },
  // --- 2. find("something that doesnt exist") ---
  {
    name: 'find — "something that doesnt exist"',
    run: () => formatFind(handleFind(data, { query: "xyzzy nonexistent thing" })),
    check: (out: string) => {
      const isEmpty = out.includes('No matches') || out.startsWith('0 results');
      return { pass: true, reason: isEmpty ? 'empty results (expected)' : `got results: ${out.slice(0, 100)}` };
    },
  },
  // --- 3. get("Button") ---
  {
    name: 'get — "Button"',
    run: () => formatGet(handleGet(data, { name: "Button" }), "compact"),
    check: (out: string) => {
      const hasImport = out.includes('import');
      const hasProps = out.includes('Props');
      return { pass: hasImport && hasProps, reason: `import=${hasImport}, props=${hasProps}` };
    },
  },
  // --- 4. get("confirmation-dialog") ---
  {
    name: 'get — "confirmation-dialog"',
    run: () => formatGet(handleGet(data, { name: "confirmation-dialog" }), "compact"),
    check: (out: string) => {
      const hasWhen = out.includes('When:');
      const hasComponents = out.includes('Components:');
      return { pass: hasWhen || hasComponents, reason: `when=${hasWhen}, components=${hasComponents}` };
    },
  },
  // --- 5. get("spacing") ---
  {
    name: 'get — "spacing"',
    run: () => formatGet(handleGet(data, { name: "spacing" }), "compact"),
    check: (out: string) => {
      const hasValues = out.includes('px') || out.includes('Spacing');
      return { pass: hasValues, reason: hasValues ? 'has token values' : 'no token values' };
    },
  },
  // --- 6. get("uikit") ---
  {
    name: 'get — "uikit"',
    run: () => formatGet(handleGet(data, { name: "uikit" }), "compact"),
    check: (out: string) => {
      const hasPackage = out.includes('@gravity-ui/uikit');
      const hasComponents = out.includes('components');
      return { pass: hasPackage, reason: `package=${hasPackage}, components=${hasComponents}` };
    },
  },
  // --- 7. get("overview") ---
  {
    name: 'get — "overview"',
    run: () => formatGet(handleGet(data, { name: "overview" }), "compact"),
    check: (out: string) => {
      const hasSystem = out.includes('Gravity UI') || out.includes('Design System');
      const hasLibraries = out.includes('libraries');
      return { pass: hasSystem, reason: `system=${hasSystem}, libraries=${hasLibraries}` };
    },
  },
  // --- 8. get("NonExistent") ---
  {
    name: 'get — "NonExistent"',
    run: () => formatGet(handleGet(data, { name: "NonExistent" }), "compact"),
    check: (out: string) => {
      const isNotFound = out.includes('not found');
      return { pass: isNotFound, reason: isNotFound ? 'got not_found' : `unexpected: ${out.slice(0, 100)}` };
    },
  },
  // --- 9. list() — table of contents ---
  {
    name: 'list — no args (table of contents)',
    run: () => formatList(handleList(data, {})),
    check: (out: string) => {
      const hasComponents = out.includes('Components:');
      const hasRecipes = out.includes('Recipes:');
      const hasTokens = out.includes('Tokens:');
      return {
        pass: hasComponents && hasRecipes,
        reason: `components=${hasComponents}, recipes=${hasRecipes}, tokens=${hasTokens}`,
      };
    },
  },
  // --- 10. list("components") ---
  {
    name: 'list — "components"',
    run: () => formatList(handleList(data, { what: "components" })),
    check: (out: string) => {
      const hasCount = /^\d+ components/.test(out);
      const hasCategories = out.includes('(') && out.split('\n').length > 5;
      return { pass: hasCount && hasCategories, reason: `count=${hasCount}, categories=${hasCategories}` };
    },
  },
  // --- 11. list("recipes") ---
  {
    name: 'list — "recipes"',
    run: () => formatList(handleList(data, { what: "recipes" })),
    check: (out: string) => {
      const hasRecipes = out.includes('recipes');
      const hasLevels = out.includes('molecule') || out.includes('foundation') || out.includes('organism');
      return { pass: hasRecipes && hasLevels, reason: `recipes=${hasRecipes}, levels=${hasLevels}` };
    },
  },
  // --- 12. list("tokens") ---
  {
    name: 'list — "tokens"',
    run: () => formatList(handleList(data, { what: "tokens" })),
    check: (out: string) => {
      const hasTopics = out.includes('spacing') || out.includes('breakpoints');
      return { pass: hasTopics, reason: hasTopics ? 'has token topics' : 'no topics' };
    },
  },
];

let passCount = 0;
let failCount = 0;

for (const test of tests) {
  console.log("=".repeat(70));
  console.log(`TEST: ${test.name}`);
  console.log("-".repeat(70));
  try {
    const output = test.run();
    const preview = output.length > 500 ? output.slice(0, 500) + "\n... [truncated]" : output;
    console.log("OUTPUT:");
    console.log(preview);
    console.log("-".repeat(70));
    const { pass, reason } = test.check(output);
    if (pass) {
      console.log(`PASS: ${reason}`);
      passCount++;
    } else {
      console.log(`FAIL: ${reason}`);
      failCount++;
    }
  } catch (err: unknown) {
    console.log(`FAIL (exception): ${err instanceof Error ? err.stack : String(err)}`);
    failCount++;
  }
  console.log("");
}

console.log("=".repeat(70));
console.log(`SUMMARY: ${passCount} passed, ${failCount} failed, ${tests.length} total`);
if (failCount > 0) process.exit(1);
```

- [ ] Step 2: Run smoke tests

```
pnpm build && npx tsx src/server/smoke-test.ts
```

Expect: 12/12 pass.

- [ ] Step 3: Commit

```
git add src/server/smoke-test.ts
git commit -m "test: update smoke tests for v1.0.0 find/get/list tools"
```

---

### Task 12: Clean up

- [ ] Step 1: Remove draft recipe files

Delete the following files (they have been consolidated into `data/recipes.json` in Task 5):
- `data/recipes-sample.json`
- `data/recipes-sample-v2.json`
- `data/recipes-sample-complex.json`
- `data/recipes-sample-stress-test.json`
- `data/recipes-v3.json`
- `data/recipes-v4-confirmation.json`
- `data/recipes-v4-data-table.json`
- `data/recipes-v4-file-upload.json`
- `data/recipes-v4-page-states.json`
- `data/recipes-v4-theming.json`

- [ ] Step 2: Verify suggest-component.ts is still needed

`suggest-component.ts` is NOT removed. It is still imported by `find.ts` (for `handleSuggestComponent`, `tokenizeAndClean`, `levenshtein`) and by `get.ts` (for fuzzy fallback). It remains as an internal utility, just no longer registered as a standalone MCP tool.

Verify no dead code: `search-docs.ts`, `list-components.ts`, `get-component.ts`, `get-design-tokens.ts` are all still imported by the new handlers or their formatters. None should be deleted.

- [ ] Step 3: Verify build is clean

```
pnpm build
pnpm test -- --run
```

Expect: build succeeds, all tests pass.

- [ ] Step 4: Commit

```
git add -A
git commit -m "chore: remove draft recipe files, finalize v1.0.0 cleanup"
```

---

### File inventory (all chunks combined)

New files:
- `data/recipes.json` — consolidated recipe data (5 recipes)
- `src/server/tools/lib-priority.ts` — shared library priority constant + picker
- `src/server/tools/find.ts` — handleFind, formatFind, interfaces
- `src/server/tools/get.ts` — handleGet, formatGet, formatRecipe, formatLibrary, formatOverview, interfaces
- `src/server/tools/list.ts` — handleList, formatList, formatTableOfContents, formatRecipeList, formatLibraryList, formatTokenList, interfaces
- `src/server/tools/__tests__/find.test.ts`
- `src/server/tools/__tests__/get.test.ts`
- `src/server/tools/__tests__/list.test.ts`

Modified files:
- `src/types.ts` — RecipeDef types, RecipeLevel, RecipeSection, TokenSet typography
- `src/schemas.ts` — RecipeDefSchema, RecipeSectionSchema, RecipeLevelSchema, TokenSetSchema typography
- `src/schemas.test.ts` — recipe schema tests, TokenSet typography test
- `src/server/loader.ts` — LoadedData.recipes, LoadedData.recipeById, recipe loading
- `src/server/loader.test.ts` — recipe loading tests
- `src/ingest/validate.ts` — recipe validation + cross-reference checks
- `src/ingest/validate.test.ts` — recipe validation tests
- `src/server/server.ts` — replace 5 tools with 3, bump to 1.0.0
- `src/server/smoke-test.ts` — 12 new test cases

Removed files:
- `data/recipes-sample.json`
- `data/recipes-sample-v2.json`
- `data/recipes-sample-complex.json`
- `data/recipes-sample-stress-test.json`
- `data/recipes-v3.json`
- `data/recipes-v4-confirmation.json`
- `data/recipes-v4-data-table.json`
- `data/recipes-v4-file-upload.json`
- `data/recipes-v4-page-states.json`
- `data/recipes-v4-theming.json`

Kept (still used internally, no longer exposed as standalone tools):
- `src/server/tools/suggest-component.ts` — used by find.ts and get.ts
- `src/server/tools/search-docs.ts` — used by find.ts
- `src/server/tools/list-components.ts` — used by list.ts
- `src/server/tools/get-component.ts` — used by get.ts (formatGetComponent)
- `src/server/tools/get-design-tokens.ts` — used by get.ts (formatGetDesignTokens)
