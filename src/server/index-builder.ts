// src/server/index-builder.ts
import MiniSearch from 'minisearch';
import type { Entity } from '../schemas.js';

interface IndexDocument {
  id: string;
  entityType: string;
  library: string;
  name: string;
  description: string;
  keywords: string;
  when_to_use: string;
}

const FIELDS = ['name', 'description', 'keywords', 'when_to_use'];
const STORE_FIELDS = ['id', 'entityType', 'library', 'name'];
const BOOST = { name: 3, keywords: 2, when_to_use: 2, description: 1 };

function entityToDoc(entity: Entity): IndexDocument {
  return {
    id: `${entity.type}:${entity.library}:${entity.name}`,
    entityType: entity.type,
    library: entity.library,
    name: entity.name,
    description: entity.description,
    keywords: entity.keywords.join(' '),
    when_to_use: entity.when_to_use.join(' '),
  };
}

export function buildSearchIndex(entities: Entity[]): MiniSearch {
  const ms = new MiniSearch<IndexDocument>({
    fields: FIELDS,
    storeFields: STORE_FIELDS,
    searchOptions: { boost: BOOST, prefix: true, fuzzy: 0.2 },
  });
  // Deduplicate by id before indexing
  const seen = new Set<string>();
  const docs = entities.map(entityToDoc).filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
  ms.addAll(docs);
  return ms;
}

export interface SearchResult {
  id: string;
  entityType: string;
  library: string;
  name: string;
  score: number;
}

export function searchEntities(
  index: MiniSearch,
  query: string,
  options?: { type?: string; limit?: number },
): SearchResult[] {
  const limit = options?.limit ?? 10;
  const raw = index.search(query);
  const filtered = options?.type
    ? raw.filter(r => r.entityType === options.type)
    : raw;
  return filtered.slice(0, limit).map(r => ({
    id: r.id as string,
    entityType: r.entityType as string,
    library: r.library as string,
    name: r.name as string,
    score: r.score,
  }));
}
