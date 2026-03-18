import type { LoadedData } from '../loader.js';
import { handleListComponents, formatListComponents } from './list-components.js';
import type { ListComponentsOutput } from './list-components.js';
import { ALL_LIBRARIES } from '../../ingest/manifest.js';

export type EntityType = 'component' | 'hook' | 'api-function' | 'asset' | 'token' | 'config-package' | 'library';

export interface ListInput {
  what?: 'components' | 'recipes' | 'libraries' | 'tokens';
  filter?: string;
  // New ecosystem fields:
  type?: EntityType;
  library?: string;
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
  byLevel: Record<string, RecipeListItem[]>;
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

export interface ComponentsListOutput extends ListComponentsOutput {
  kind: 'components';
}

export interface EcosystemLibraryItem {
  id: string;
  npmPackage: string;
  category: 'component' | 'asset' | 'utility' | 'config';
}

export interface EcosystemLibraryListOutput {
  kind: 'ecosystem-libraries';
  byCategory: Record<string, EcosystemLibraryItem[]>;
  totalCount: number;
}

export interface EcosystemEntityListOutput {
  kind: 'ecosystem-entities';
  type: EntityType;
  library?: string;
  entities: Array<{ name: string; library: string; kind?: string }>;
  totalCount: number;
}

export type ListOutput = TableOfContents | RecipeListOutput | LibraryListOutput | TokenListOutput | ComponentsListOutput | ErrorOutput | EcosystemLibraryListOutput | EcosystemEntityListOutput;

const VALID_WHATS = new Set(['components', 'recipes', 'libraries', 'tokens']);

const TOKEN_HINTS: Record<string, string> = {
  spacing: '4px grid',
  breakpoints: 'responsive breakpoints',
  sizes: 'component heights',
  colors: 'semantic color tokens',
  typography: 'named type scales',
};

// ---------------------------------------------------------------------------
// Ecosystem helpers
// ---------------------------------------------------------------------------

export function buildEcosystemLibraryList(libraryFilter?: string): EcosystemLibraryListOutput {
  const filtered = libraryFilter
    ? ALL_LIBRARIES.filter(l => l.id === libraryFilter)
    : ALL_LIBRARIES;

  const byCategory: Record<string, EcosystemLibraryItem[]> = {};
  for (const lib of filtered) {
    if (!byCategory[lib.category]) byCategory[lib.category] = [];
    byCategory[lib.category].push({ id: lib.id, npmPackage: lib.npmPackage, category: lib.category });
  }
  return { kind: 'ecosystem-libraries', byCategory, totalCount: filtered.length };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export function handleList(data: LoadedData, input: ListInput): ListOutput {
  const { what, filter, type, library } = input;

  // Ecosystem: type === 'library' or type === 'library' with library filter
  if (type === 'library') {
    return buildEcosystemLibraryList(library);
  }

  // Ecosystem: specific entity type requested
  if (type && type !== 'token') {
    let entities: Array<{ name: string; library: string; kind?: string }> = [];

    if (type === 'component') {
      const compList = library
        ? (data.componentsByLibrary.get(library) ?? [])
        : data.componentDefs;
      entities = compList.map(c => ({ name: c.name, library: c.library }));
    } else if (type === 'hook') {
      const hookList = library
        ? (data.hooksByLibrary.get(library) ?? [])
        : data.hooks;
      entities = hookList.map(h => ({ name: h.name, library: h.library, kind: 'hook' }));
    } else if (type === 'asset') {
      const assetList = library
        ? (data.assetsByLibrary.get(library) ?? [])
        : data.assets;
      entities = assetList.map(a => ({ name: a.name, library: a.library, kind: a.category }));
    } else if (type === 'api-function') {
      const fnList = library
        ? (data.apiFunctionsByLibrary.get(library) ?? [])
        : data.apiFunctions;
      entities = fnList.map(f => ({ name: f.name, library: f.library, kind: f.kind }));
    } else if (type === 'config-package') {
      const configList = library
        ? data.configDocs.filter(c => c.library === library)
        : data.configDocs;
      entities = configList.map(c => ({ name: c.library, library: c.library, kind: 'config' }));
    }

    return {
      kind: 'ecosystem-entities',
      type,
      library,
      entities,
      totalCount: entities.length,
    };
  }

  // Ecosystem: library filter with no type → list all entities for that library
  if (library && !type && !what) {
    return buildEcosystemLibraryList(library);
  }

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

  if (what === 'recipes') {
    let filtered = data.recipes;
    if (filter) {
      filtered = data.recipes.filter(r => r.level === filter);
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
      libraries: data.overview.libraries.map(lib => ({
        id: lib.id,
        package: lib.package,
        componentCount: lib.component_count,
        purpose: lib.purpose,
      })),
    };
  }

  // what === 'tokens'
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

/** Extract the first sentence from a string. */
function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : text.trim();
}


export function formatList(output: ListOutput): string {
  if (output.kind === 'error') {
    return output.message;
  }

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

  if (output.kind === 'components') {
    return formatListComponents(output);
  }

  if (output.kind === 'recipes') {
    const lines: string[] = [];
    lines.push(`${output.totalCount} recipes`);
    lines.push('');
    for (const [level, items] of Object.entries(output.byLevel)) {
      lines.push(`${level} (${items.length})`);
      for (const item of items) {
        lines.push(`  ${item.id} — ${item.description}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  if (output.kind === 'libraries') {
    const lines: string[] = [];
    lines.push(`${output.libraries.length} libraries`);
    lines.push('');
    for (const lib of output.libraries) {
      lines.push(`${lib.id} (${lib.package}) — ${lib.componentCount} components, ${firstSentence(lib.purpose)}`);
    }
    return lines.join('\n').trim();
  }

  if (output.kind === 'ecosystem-libraries') {
    const lines: string[] = [];
    lines.push(`${output.totalCount} libraries`);
    lines.push('');
    for (const [category, libs] of Object.entries(output.byCategory)) {
      lines.push(`${category} (${libs.length})`);
      for (const lib of libs) {
        lines.push(`  ${lib.id} — ${lib.npmPackage}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  if (output.kind === 'ecosystem-entities') {
    const lines: string[] = [];
    const label = output.library ? ` in ${output.library}` : '';
    lines.push(`${output.totalCount} ${output.type}s${label}`);
    lines.push('');
    for (const e of output.entities) {
      const kindSuffix = e.kind ? ` (${e.kind})` : '';
      lines.push(`${e.name} [${e.library}]${kindSuffix}`);
    }
    return lines.join('\n').trim();
  }

  // tokens
  const lines: string[] = [];
  lines.push(`${output.topics.length} token topics`);
  lines.push('');
  for (const t of output.topics) {
    lines.push(`${t.topic} — ${t.hint}, ${t.count} values`);
  }
  return lines.join('\n').trim();
}
