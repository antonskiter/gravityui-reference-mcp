import type { LoadedData } from '../loader.js';
import type { ComponentDef } from '../../types.js';
import { pickByLibraryPriority } from './lib-priority.js';
import { handleSuggestComponent, levenshtein } from './suggest-component.js';
import { formatGetComponent } from './get-component.js';
import { formatGetDesignTokens } from './get-design-tokens.js';

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
      data: { [nameLower]: (data.tokens as Record<string, unknown>)[nameLower] },
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
      return `[recipe] ${output.data.title}: ${output.data.description}`;
    case 'library':
      return `[library] ${output.data.id} (${output.data.package}): ${output.data.purpose}`;
    case 'overview':
      return `[overview] ${output.data.system.description}`;
    default:
      return `[${output.type}] ${JSON.stringify(output.data).slice(0, 200)}`;
  }
}
