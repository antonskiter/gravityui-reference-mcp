import { searchEntities, type SearchResult } from '../index-builder.js';
import type { LoadedData } from '../loader.js';

export interface FindInput {
  query: string;
  type?: string;
}

export interface FindOutput {
  query: string;
  results: Array<{
    name: string;
    type: string;
    library: string;
    description: string;
    score: number;
  }>;
}

export function handleFind(data: LoadedData, input: FindInput): FindOutput {
  const searchResults = searchEntities(data.index, input.query, {
    type: input.type,
    limit: 10,
  });

  const results = searchResults.map(sr => {
    // Look up full entity or recipe for description
    const entities = data.entityByName.get(sr.name);
    const entity = entities?.[0];
    const recipe = data.recipeById.get(sr.id.replace('recipe:', ''));
    const description = entity?.description ?? recipe?.description ?? '';

    return {
      name: sr.name,
      type: sr.entityType,
      library: sr.library,
      description,
      score: sr.score,
    };
  });

  return { query: input.query, results };
}

export function formatFind(output: FindOutput): string {
  if (output.results.length === 0) {
    return `No results for "${output.query}".`;
  }

  const lines: string[] = [`Results for "${output.query}":\n`];
  for (const r of output.results) {
    const lib = r.library ? ` (${r.library})` : '';
    lines.push(`[${r.type}] ${r.name}${lib}`);
    lines.push(`   ${r.description}`);
    lines.push('');
  }
  return lines.join('\n');
}
