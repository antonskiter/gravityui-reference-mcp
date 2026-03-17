import type { LoadedData } from '../loader.js';
import { handleListComponents, formatListComponents } from './list-components.js';
import type { ListComponentsOutput } from './list-components.js';

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

export type ListOutput = TableOfContents | RecipeListOutput | LibraryListOutput | TokenListOutput | ComponentsListOutput | ErrorOutput;

const VALID_WHATS = new Set(['components', 'recipes', 'libraries', 'tokens']);

const TOKEN_HINTS: Record<string, string> = {
  spacing: '4px grid',
  breakpoints: 'responsive breakpoints',
  sizes: 'component heights',
  colors: 'semantic color tokens',
  typography: 'named type scales',
};

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

/** Format token value range as a compact summary. */
function tokenRange(values: Record<string, unknown>): string {
  const keys = Object.keys(values);
  if (keys.length === 0) return '';
  if (keys.length <= 3) return keys.join(', ');
  return `${keys[0]}..${keys[keys.length - 1]}`;
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

  // tokens
  const lines: string[] = [];
  lines.push(`${output.topics.length} token topics`);
  lines.push('');
  for (const t of output.topics) {
    lines.push(`${t.topic} — ${t.hint}, ${t.count} values`);
  }
  return lines.join('\n').trim();
}
