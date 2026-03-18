import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LoadedData } from '../loader.js';
import type { ComponentDef, RecipeDef, RecipeSection, LibraryOverviewEntry, DesignSystemOverview } from '../../types.js';
import { pickByLibraryPriority } from './lib-priority.js';
import { handleSuggestComponent, levenshtein } from './suggest-component.js';
import { formatGetComponent } from './get-component.js';
import { formatGetDesignTokens } from './get-design-tokens.js';
import { codeBlock } from '../format.js';
import { ALL_LIBRARIES } from '../../ingest/manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');

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

const TOKEN_TOPICS = new Set(['spacing', 'breakpoints', 'sizes', 'colors', 'typography']);

export function handleGet(data: LoadedData, input: GetInput): GetOutput {
  const { name } = input;
  const nameLower = name.toLowerCase();

  // Priority 1: token topic
  if (TOKEN_TOPICS.has(nameLower)) {
    return {
      type: 'tokens',
      data: { [nameLower]: (data.tokens as unknown as Record<string, unknown>)[nameLower] },
    };
  }

  // Priority 2: overview
  if (nameLower === 'overview') {
    return { type: 'overview', data: data.overview };
  }

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
    (l) => l.id === nameLower || l.id === name,
  );
  if (lib) {
    return { type: 'library', data: lib };
  }

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
}

export function formatGet(output: GetOutput, detail: 'compact' | 'full' = 'compact'): string {
  switch (output.type) {
    case 'component': {
      const formatted = formatGetComponent({ component: output.data }, detail);
      if (output.seeAlso && output.seeAlso.length > 0) {
        return `${formatted}\n\nAlso available in: ${output.seeAlso.join(', ')}`;
      }
      return formatted;
    }
    case 'tokens':
      return formatGetDesignTokens(output.data);
    case 'not_found': {
      const d = output.data;
      const similar = d.suggestions?.length > 0 ? ` Similar: ${d.suggestions.join(', ')}` : '';
      return `'${d.name}' not found.${similar} Try find('${d.name}') for broader search.`;
    }
    case 'recipe':
      return formatRecipe(output.data, detail);
    case 'library':
      return formatLibrary(output.data);
    case 'overview':
      return formatOverview(output.data);
    default:
      return `[${output.type}] ${JSON.stringify(output.data).slice(0, 200)}`;
  }
}

// --- Recipe formatter ---

function getSection<T extends RecipeSection>(recipe: RecipeDef, type: T['type']): T | undefined {
  return recipe.sections.find(s => s.type === type) as T | undefined;
}

function getSections<T extends RecipeSection>(recipe: RecipeDef, type: T['type']): T[] {
  return recipe.sections.filter(s => s.type === type) as T[];
}

export function formatRecipe(recipe: RecipeDef, detail: 'compact' | 'full' = 'compact'): string {
  const lines: string[] = [];

  // Header
  lines.push(`${recipe.title} (${recipe.level})`);
  lines.push(recipe.description);

  // Decision section
  const decision = getSection<import('../../types.js').RecipeDecisionSection>(recipe, 'decision');
  if (decision) {
    lines.push('');
    lines.push(`When: ${decision.when}`);
    lines.push(`Not for: ${decision.not_for}`);
  }

  // Components section
  const components = getSection<import('../../types.js').RecipeComponentsSection>(recipe, 'components');
  if (components && components.items.length > 0) {
    lines.push('');
    lines.push('Components:');
    for (const item of components.items) {
      lines.push(`   ${item.name} (${item.library}) [${item.usage}] — ${item.role}`);
    }
  }

  // Install
  if (recipe.packages.length > 0) {
    lines.push('');
    lines.push(`Install: ${recipe.packages.join(' ')}`);
  }

  if (detail === 'full') {
    // Structure section (tree and/or flow)
    const structure = getSection<import('../../types.js').RecipeStructureSection>(recipe, 'structure');
    if (structure) {
      if (structure.tree && structure.tree.length > 0) {
        lines.push('');
        lines.push('Structure:');
        for (const node of structure.tree) {
          lines.push(`   ${node}`);
        }
      }
      if (structure.flow && structure.flow.length > 0) {
        lines.push('');
        lines.push('Flow:');
        for (const step of structure.flow) {
          lines.push(`   ${step}`);
        }
      }
    }

    // Decision matrix
    if (decision?.matrix && decision.matrix.length > 0) {
      lines.push('');
      lines.push('Decision matrix:');
      for (const entry of decision.matrix) {
        lines.push(`   ${entry.situation} -> ${entry.component} — ${entry.why}`);
      }
    }

    // All examples
    const examples = getSections<import('../../types.js').RecipeExampleSection>(recipe, 'example');
    for (const example of examples) {
      lines.push('');
      lines.push(`Example: ${example.title}`);
      lines.push(codeBlock('tsx', example.code));
    }

    // Avoid section
    const avoid = getSection<import('../../types.js').RecipeAvoidSection>(recipe, 'avoid');
    if (avoid && avoid.items.length > 0) {
      lines.push('');
      lines.push('Avoid:');
      for (const item of avoid.items) {
        lines.push(`   ${item}`);
      }
    }

    // Related section
    const related = getSection<import('../../types.js').RecipeRelatedSection>(recipe, 'related');
    if (related && related.items.length > 0) {
      lines.push('');
      lines.push('Related:');
      for (const item of related.items) {
        lines.push(`   ${item.id} — ${item.note}`);
      }
    }
  }

  return lines.join('\n');
}

// --- Library formatter ---

export function formatLibrary(lib: LibraryOverviewEntry): string {
  const lines: string[] = [];
  const pkg = lib.package.startsWith('@') ? lib.package : `@${lib.package}`;
  lines.push(`${lib.id} (${pkg})`);
  lines.push(lib.purpose);
  lines.push(`${lib.component_count} components`);
  lines.push(`Depends on: ${lib.depends_on && lib.depends_on.length > 0 ? lib.depends_on.join(', ') : 'none'}`);
  lines.push(`Used by: ${lib.is_peer_dependency_of && lib.is_peer_dependency_of.length > 0 ? lib.is_peer_dependency_of.join(', ') : 'none'}`);
  return lines.join('\n');
}

// --- Overview formatter ---

export function formatOverview(overview: DesignSystemOverview): string {
  const lines: string[] = [];
  lines.push('Gravity UI Design System');
  lines.push(`Theming: ${overview.system.theming}`);
  lines.push(`Spacing: ${overview.system.spacing}`);
  lines.push(`Typography: ${overview.system.typography}`);
  const libIds = overview.libraries.map(l => l.id).join(', ');
  lines.push(`${overview.libraries.length} libraries: ${libIds}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Ecosystem resolveGet — two-stage resolution across all data directories
// ---------------------------------------------------------------------------

function readDataJson<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function scanDataDir(subDir: string): string[] {
  const dirPath = join(DATA_DIR, subDir);
  if (!existsSync(dirPath)) return [];
  try {
    return readdirSync(dirPath).filter(f => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

function formatLibraryCard(lib: { id: string; npmPackage: string; category: string }): string {
  return `${lib.id} (${lib.npmPackage})\ncategory: ${lib.category}`;
}

function formatHookEntry(hook: { name: string; signature?: string; return_type?: string; library?: string }): string {
  const lines = [`hook: ${hook.name}`];
  if (hook.library) lines.push(`library: ${hook.library}`);
  if (hook.signature) lines.push(`signature: ${hook.signature}`);
  if (hook.return_type) lines.push(`returns: ${hook.return_type}`);
  return lines.join('\n');
}

function formatApiFunctionEntry(fn: { name: string; kind?: string; signature?: string; library?: string; description?: string }): string {
  const lines = [`${fn.kind ?? 'export'}: ${fn.name}`];
  if (fn.library) lines.push(`library: ${fn.library}`);
  if (fn.signature) lines.push(`signature: ${fn.signature}`);
  if (fn.description) lines.push(fn.description);
  return lines.join('\n');
}

function formatAssetEntry(asset: { name: string; library?: string; category?: string; import_path?: string }): string {
  const lines = [`asset: ${asset.name}`];
  if (asset.library) lines.push(`library: ${asset.library}`);
  if (asset.category) lines.push(`category: ${asset.category}`);
  if (asset.import_path) lines.push(`import: import { ${asset.name} } from '${asset.import_path}';`);
  return lines.join('\n');
}

function formatConfigEntry(cfg: { library?: string; npm_package?: string; description?: string; how_to_use?: string }): string {
  const lines = [`config: ${cfg.library ?? '(unknown)'}`];
  if (cfg.npm_package) lines.push(`package: ${cfg.npm_package}`);
  if (cfg.description) lines.push(cfg.description);
  if (cfg.how_to_use) lines.push(`usage: ${cfg.how_to_use}`);
  return lines.join('\n');
}

/**
 * Two-stage resolution:
 * Stage 1: exact library name / npm package match (fast path — no data dir scan needed)
 * Stage 2: cascade across data directories
 *   component > hook > api-function > asset > config-package
 */
export async function resolveGet(topic: string): Promise<string> {
  const topicLower = topic.toLowerCase();

  // Stage 1: exact library id or npm package match
  const libMeta = ALL_LIBRARIES.find(
    l => l.id === topicLower || l.id === topic || l.npmPackage === topic || l.npmPackage === topicLower,
  );
  if (libMeta) return formatLibraryCard(libMeta);

  // Stage 2: scan components directory for matching component or hook
  for (const file of scanDataDir('components')) {
    const libId = file.replace(/\.json$/, '');
    const data = readDataJson<{
      components?: Array<{ name: string; description?: string; import_statement?: string; props?: unknown[] }>;
      hooks?: Array<{ name: string; signature?: string; return_type?: string; library?: string }>;
    }>(join(DATA_DIR, 'components', file), {});

    // Check components
    const comp = (data.components ?? []).find(
      c => c.name === topic || c.name.toLowerCase() === topicLower,
    );
    if (comp) {
      const lines = [`component: ${comp.name}`, `library: ${libId}`];
      if (comp.description) lines.push(comp.description);
      if (comp.import_statement) lines.push(`import: ${comp.import_statement}`);
      if (comp.props && Array.isArray(comp.props)) {
        lines.push(`props: ${comp.props.length} props`);
      }
      return lines.join('\n');
    }

    // Check hooks
    const hook = (data.hooks ?? []).find(
      h => h.name === topic || h.name.toLowerCase() === topicLower,
    );
    if (hook) return formatHookEntry({ ...hook, library: hook.library ?? libId });
  }

  // Stage 2: scan utilities directory for api-functions
  for (const file of scanDataDir('utilities')) {
    const libId = file.replace(/\.json$/, '');
    const data = readDataJson<{
      exports?: Array<{ name: string; kind?: string; signature?: string; library?: string; description?: string }>;
      skipped?: boolean;
    }>(join(DATA_DIR, 'utilities', file), {});

    if (data.skipped) continue;

    const fn = (data.exports ?? []).find(
      e => e.name === topic || e.name.toLowerCase() === topicLower,
    );
    if (fn) return formatApiFunctionEntry({ ...fn, library: fn.library ?? libId });
  }

  // Stage 2: scan assets directory
  for (const file of scanDataDir('assets')) {
    const libId = file.replace(/\.json$/, '');
    const data = readDataJson<{
      assets?: Array<{ name: string; library?: string; category?: string; import_path?: string }>;
    }>(join(DATA_DIR, 'assets', file), {});

    const asset = (data.assets ?? []).find(
      a => a.name === topic || a.name.toLowerCase() === topicLower,
    );
    if (asset) return formatAssetEntry({ ...asset, library: asset.library ?? libId });
  }

  // Stage 2: scan configs directory
  for (const file of scanDataDir('configs')) {
    const libId = file.replace(/\.json$/, '');
    const data = readDataJson<{
      library?: string;
      npm_package?: string;
      description?: string;
      how_to_use?: string;
    }>(join(DATA_DIR, 'configs', file), {});

    const configId = data.library ?? libId;
    if (configId === topic || configId === topicLower || libId === topic || libId === topicLower) {
      return formatConfigEntry(data);
    }
  }

  return `"${topic}" not found. Try find('${topic}') for broader search.`;
}
