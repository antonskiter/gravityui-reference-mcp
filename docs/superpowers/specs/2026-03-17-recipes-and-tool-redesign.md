# Recipes & Tool Redesign

Date: 2026-03-17
Status: Draft

## Problem

Claude agents building UI with Gravity UI frequently write custom code instead of using DS components. Three root causes:
- Agent doesn't know a component exists (discovery gap)
- Agent uses the component but misses built-in features (reference gap)
- Agent doesn't know how to compose components together (composition gap)

The current MCP has 5 tools focused on individual components. No tool addresses composition patterns or guides the agent away from custom solutions.

## Goal

Make Claude write better code that leverages Gravity UI fully and uses fewer custom solutions.

## Solution: Two changes

1. Add a recipe data layer — composition patterns with code, structure, and anti-patterns
2. Redesign tools from 5 specialized to 3 intent-based

---

## Part 1: Recipe Data Format

### What qualifies as a recipe

A recipe starts at the molecule level of atomic design — where 2+ atoms combine in a non-obvious way. Single component usage is handled by `get`. Recipes fill the gap from molecules upward.

Threshold test: if the answer is "read one component's props page," it is not a recipe. If the answer requires coordinating 2+ components or making non-obvious design decisions, it is a recipe.

### Levels (atomic design scale)

- foundation — infrastructure/setup (theming, provider configuration)
- molecule — small composition, 2-3 components (confirmation dialog, toast feedback, page states)
- organism — complex UI section, 4+ components with state/data flow (data table, form with validation, file upload, settings page)

### Recipe JSON format

Top-level fields (always present, searchable):

- id — kebab-case identifier (e.g. "confirmation-dialog")
- title — human-readable name
- description — one line describing the pattern
- level — foundation | molecule | organism
- use_cases — array of plain-language scenarios where this applies
- packages — npm packages needed
- tags — searchable keywords for find() scoring

Sections array (ordered by implementation workflow: understand -> configure -> compose -> use -> guard, each optional except decision + example):

1. decision — { type: "decision", when: string, not_for: string, matrix?: [{situation, component, why}] }
   - when: use this recipe if...
   - not_for: don't use this for... (redirects to correct pattern)
   - matrix: optional multi-way decision table (which sub-component for which situation)

2. setup — { type: "setup", steps: string[], packages?: string[] }
   - Provider wrapping, CSS imports, configuration steps
   - Only for recipes that need pre-configuration (theming, ToasterProvider)
   - packages: optional override of top-level packages for setup-specific dependencies

3. components — { type: "components", items: [{name, library, usage, role}] }
   - name: PascalCase component name (matches get() lookup)
   - library: short ID (uikit, components, navigation, etc.) matching the component data model
   - usage: required | optional | alternative
   - role: one line — what it does in this recipe

4. custom_parts — { type: "custom_parts", items: [{name, description, approach}] }
   - For things the DS doesn't cover (e.g. dropzone in file upload)
   - name: PascalCase identifier for the custom part
   - description: what this part does
   - approach: how to build it — should reference DS tokens for visual consistency
   - Note: No code in custom_parts — code lives in examples only.

5. structure — { type: "structure", tree?: string[], flow?: string[] }
   - tree: component nesting (for composition recipes)
   - flow: branching logic (for pattern recipes, e.g. isError? -> X, isLoading? -> Y)
   - Both optional — use whichever fits, or both
   - Note: flow is always a field INSIDE structure, never a standalone section. Use `flow` not `data_flow`.

6. example — { type: "example", title: string, code: string }
   - Can appear multiple times (1-3 per recipe)
   - Max ~100 lines per example
   - Must use real, verified Gravity UI props
   - Includes imports, state management, JSX

7. avoid — { type: "avoid", items: string[] }
   - Each item: "anti-pattern — why DS handles it better"
   - This is the highest-value field for preventing custom code

8. related — { type: "related", items: [{id, note}] }
   - Cross-references to other recipes
   - note: how they connect (e.g. "use Toaster after action completes")
   - Note: related recipe IDs that reference not-yet-created recipes should use the planned ID. Validation will warn but not fail for missing related targets during initial implementation.

Note: Extra fields in recipe data (e.g. key_props) are ignored by formatters. The spec defines the minimum required schema.

### Initial recipe set (~7 recipes)

foundation:
- theming-dark-mode — ThemeProvider setup, CSS imports, useTheme, toggle

molecule:
- confirmation-dialog — ConfirmDialog/Dialog + Button
- page-states — Skeleton/Loader/PlaceholderContainer branching
- user-feedback — Toaster vs Alert vs Notifications decision

organism:
- data-table — Table + TextInput + Pagination + DropdownMenu + ActionsPanel
- file-upload — FilePreview + Progress + custom dropzone
- settings-page — Settings + Card + FormRow + ActionBar

Status: confirmation-dialog, page-states, theming-dark-mode, data-table, file-upload have v4 drafts. user-feedback and settings-page need to be created during implementation.

---

## Part 2: Tool Redesign

### Design principle

Tools are organized by agent intent, not by data type. Each tool is universal across all entity types (components, recipes, tokens, libraries, docs).

### 3 tools

#### find(query)

Intent: "What should I use?"

Input:
- query: string (required) — natural language description of what the agent needs

Output: compact cards, mixed types, max 7 results total. Plain text.

Format:
```
N results

[recipe] {id} ({level})
  {description}
  Components: {name1}, {name2}, {name3}

[component] {Name} ({library}) {score}
  {description}

[doc] {page_title} — {section_title}
  {snippet, max 100 chars}
```

Scoring:
- Recipe match: score against use_cases + tags (not component lists)
- Component match: existing 3-part scoring (30% tags + 50% MiniSearch + 20% def)
- Doc match: MiniSearch with page dedup

Caps: max 2 recipes, 3 components, 2 docs.

Token topics and libraries are discoverable via list(), not find(). find() searches components, recipes, and docs only.

#### get(name, detail?)

Intent: "How do I use this?"

Input:
- name: string (required) — component name (PascalCase), recipe ID (kebab-case), token topic, library ID, or "overview"
- detail: "compact" | "full" (optional, default "compact")

Routing priority:
1. Exact match on token topic (spacing, breakpoints, sizes, colors, typography) -> tokens
2. Exact match "overview" -> system overview
3. Exact PascalCase match on component name -> component (prefer uikit if collision)
   Library priority for collision: uikit > components > navigation > date-components > page-constructor > table > blog-constructor. Always append 'See also: {Name} ({other_library})' when collision exists.
4. Exact kebab-case match on recipe ID -> recipe
   Partial prefix match on recipe IDs is attempted before fuzzy. get('data-table') matches 'data-table-with-filters' if it's the only prefix match.
5. Exact match on library ID -> library info
6. Fuzzy search across all namespaces -> best match + "See also" hints

Output by entity type:

Component compact (top 20 non-deprecated props, 1 example):
```
{Name} (@{package})
{description}

import {{Name}} from '{package}';

interface {Name}Props {
  {prop}: {type}; // default: {default} — {description}
  ... {N} more props
}

Example:
{code}
```

Component full: all props + all examples + source_file + github_url

Recipe compact:
```
{title} ({level})
{description}

When: {decision.when}
Not for: {decision.not_for}

Components:
  {name} ({library}) [{usage}] — {role}

Install: {packages joined}
```

Recipe full: compact + structure + matrix + all examples + avoid + related

Tokens:
```
{topic} (base unit: {hint})
  {key}: {value}
  ...
```

Library:
```
{id} (@{package})
{purpose}
{component_count} components
Depends on: {deps}
Used by: {reverse_deps}
```

Overview:
```
Gravity UI Design System
Theming: {themes}
Spacing: {description}
Typography: {description}
{library_count} libraries: {ids}
```

#### list(what?, filter?)

Intent: "What's available?"

Input:
- what: "components" | "recipes" | "libraries" | "tokens" (optional — if omitted, returns table of contents)
- filter: string (optional — category slug for components, library ID for components, level for recipes)
  Example: list("components", "uikit") for library filtering

Output:

No arguments (table of contents):
```
Components: {count} in {lib_count} libraries
  Categories: {slug1}, {slug2}, ...
Recipes: {count} patterns
  Levels: foundation, molecule, organism
Libraries: {count} packages
Tokens: {topic1}, {topic2}, ...
```

list("components"):
```
{count} components

{Category Display Name} ({count})
  {Name1}, {Name2}, {Name3}
  ...

{Category Display Name} ({count})
  ...
```

list("components", "forms"):
```
Form Controls ({count})
  {Name} ({library}) — {description}
  ...
```

list("recipes"):
```
{count} recipes

foundation
  {id} — {description}
molecule
  {id} — {description}
organism
  {id} — {description}
```

list("libraries"):
```
{count} libraries

{id} ({package}) — {count} components
  {purpose, first sentence}
...
```

list("tokens"):
```
5 token topics

spacing — 4px grid, 11 values (0-40px)
breakpoints — 5 responsive breakpoints (xs-xl)
sizes — 5 component heights (xs-xl)
colors — {count} semantic color tokens
typography — {count} named type scales
```

Note: All counts are computed dynamically from data.

The TokenSet type must be extended to include typography. Current topics: spacing, breakpoints, sizes, colors. New: typography.

---

## Part 3: Data changes

### New files

- data/recipes.json — single file with all recipes in v4 format

Note: Existing v4 JSON drafts (recipes-v4-*.json) are NOT authoritative. This spec is the source of truth. Recipe IDs defined in this spec are canonical.

### Files to clean up

Remove draft recipe files after consolidating:
- data/recipes-sample.json
- data/recipes-sample-v2.json
- data/recipes-sample-complex.json
- data/recipes-sample-stress-test.json
- data/recipes-v3.json
- data/recipes-v4-confirmation.json
- data/recipes-v4-data-table.json
- data/recipes-v4-file-upload.json
- data/recipes-v4-page-states.json
- data/recipes-v4-theming.json

### Orphaned data to expose

These exist in data/ but are not returned by any current tool:

- overview.json (system description, theming, typography) -> get("overview")
- overview.json libraries array (depends_on, is_peer_dependency_of) -> get("{library_id}"), list("libraries")
- tokens.json typography scales -> get("typography")
- pages github_url -> get("{component}", detail="full")
- pages breadcrumbs -> get() doc results
- chunks code_examples -> find() doc snippets, get() doc results
- components source_file -> get("{component}", detail="full")
- overview.json system.corner_radius -> get("overview")
- overview.json system.branding -> get("overview")
- categories.json display names -> list("components")

### Search index update

Recipes must be indexed in MiniSearch for find() to discover them. Add recipe chunks:
- page_title: recipe title
- section_title: "Recipe"
- content: description + use_cases joined + avoid items joined
- keywords: tags array

---

## Part 4: Server changes

### Remove (5 tools)

- list_components
- get_component
- suggest_component
- search_docs
- get_design_tokens

### Add (3 tools)

- find(query)
- get(name, detail?)
- list(what?, filter?)

### Tool descriptions (critical for agent routing)

find: "Find the right Gravity UI components, patterns, or recipes for your use case. Describe what you need in plain language. Returns compact cards you can expand with get()."

get: "Get full details for a component, recipe, token topic, or library by name. Use component names like 'Button', recipe IDs like 'confirmation-dialog', token topics like 'spacing', or 'overview' for the design system summary."

list: "Browse what Gravity UI offers. No arguments returns a table of contents. Filter by type: 'components', 'recipes', 'libraries', 'tokens'. Add a second argument to narrow: list('components', 'forms') or list('recipes', 'organism')."

### Backward compatibility

None needed. This is a breaking change. Bump server version from 0.2.0 to 1.0.0 (aligned with GitHub release).

---

## Part 5: Output format

All tool responses are plain text. No markdown. Only Claude reads these.

Note: Code fences (backticks) are the sole exception to the no-markdown rule — Claude needs them to distinguish code from prose.

Formatting rules (inherited from current format.ts):
- sanitize() strips markdown to plain text
- compactTable() converts tables to single-line prop descriptions
- indent() adds 3-space prefix for nested content
- codeBlock() wraps code in backticks (only for code examples)
- truncateAtWord() cuts content at word boundary

New formatters needed:
- formatFind() — renders mixed-type card list
- formatRecipe() — renders recipe sections in plain text (compact and full variants)
- formatLibrary() — renders library info
- formatOverview() — renders system overview
- formatTableOfContents() — renders list() with no arguments

Existing formatters to adapt:
- formatGetComponent() -> reuse inside get() router for components
- formatGetDesignTokens() -> reuse inside get() router for tokens
- formatListComponents() -> reuse inside list("components") router
- formatSearchDocs() -> reuse inside find() for doc results

### Error responses

- Not found: '{name}' not found. Similar: {suggestions}. Try find('{name}') for broader search.
- Empty results: No matches for '{query}'. Try list() to browse available components and recipes.
- Invalid input: '{what}' is not valid. Use: components, recipes, libraries, tokens.

---

## Part 6: Validation

### Recipe validation (extend existing run-validate.ts)

- All recipe component names must exist in component data
- All recipe library IDs must exist in metadata
- All recipe package names must be valid npm packages from library data
- All related recipe IDs must exist in recipe data
- At least one example section per recipe
- Decision section required for all recipes

### Tool integration tests (extend existing smoke-test.ts)

- find("confirmation dialog") returns at least 1 recipe and 1 component
- get("Button") returns component with props
- get("confirmation-dialog") returns recipe with sections
- get("spacing") returns token values
- get("uikit") returns library info
- get("overview") returns system description
- list() returns table of contents with counts
- list("components") returns grouped components
- list("recipes") returns recipes by level
- list("tokens") returns topic list
- get("NonExistent") returns helpful "not found" with suggestions
- find("something that doesnt exist") returns helpful empty response
