import { searchEntities } from '../index-builder.js';
import type { LoadedData } from '../loader.js';

export interface FindInput {
  query: string;
  type?: string;
  library?: string;
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

  let results = searchResults.map(sr => ({
    name: sr.name,
    type: sr.entityType,
    library: sr.library,
    description: sr.description,
    score: sr.score,
  }));

  if (input.library) {
    results = results.filter(r => r.library === input.library);
  }

  return { query: input.query, results };
}

export function formatFind(output: FindOutput): string {
  if (output.results.length === 0) {
    return `No results for "${output.query}".`;
  }

  const lines: string[] = [];
  for (const r of output.results) {
    const lib = r.library ? ` (${r.library})` : '';
    lines.push(`${r.name} [${r.type}]${lib} — ${r.description}`);
  }
  return lines.join('\n');
}
