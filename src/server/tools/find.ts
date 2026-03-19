import { searchEntities, type SearchResult } from '../index-builder.js';
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

  // Filter low-relevance noise: require minimum absolute score based on query length
  // Short queries ("button") naturally score high; long gibberish queries score low on each word
  // MiniSearch scores ~5-15 per matched word, so threshold = 2 * queryWords filters scattered partial matches
  const queryWords = input.query.trim().split(/\s+/).length;
  const minAbsoluteScore = queryWords <= 2 ? 1 : queryWords * 2;

  let results = searchResults
    .filter(sr => sr.score >= minAbsoluteScore)
    .map((sr: SearchResult) => {
      const entities = data.entityByName.get(sr.name.toLowerCase());
      const entity = entities?.find(e => !input.library || e.library === sr.library)
        ?? entities?.[0];
      const description = entity?.description ?? '';

      return {
        name: sr.name,
        type: sr.entityType,
        library: sr.library,
        description,
        score: sr.score,
      };
    });

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
