import MiniSearch from "minisearch";
import type { Chunk } from "../types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FIELDS = ["page_title", "section_title", "keywords_joined", "content"];
const STORE_FIELDS = ["id", "type", "library"];
const BOOST = { page_title: 3, section_title: 2, keywords_joined: 2, content: 1 };

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type EntityType = 'component' | 'hook' | 'api-function' | 'asset' | 'token' | 'config-package';

interface IndexDocument {
  id: string;
  page_title: string;
  section_title: string;
  keywords_joined: string;
  content: string;
  type: EntityType;    // NEW
  library: string;     // NEW
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RawIndexEntry {
  id: string;
  page_title: string;
  section_title: string;
  content: string;
  keywords: string[];
  type: EntityType;
  library: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkToDoc(chunk: Chunk, type: EntityType = 'component'): IndexDocument {
  return {
    id: chunk.id,
    page_title: chunk.page_title,
    section_title: chunk.section_title,
    keywords_joined: chunk.keywords.join(" "),
    content: chunk.content,
    type,
    library: chunk.library ?? '',
  };
}

function makeMiniSearch(): MiniSearch {
  return new MiniSearch<IndexDocument>({
    fields: FIELDS,
    storeFields: STORE_FIELDS,
    searchOptions: {
      boost: BOOST,
      prefix: true,
      fuzzy: 0.2,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildIndex(chunks: Chunk[], extraEntries: RawIndexEntry[] = []): MiniSearch {
  const ms = makeMiniSearch();
  ms.addAll(chunks.map(c => chunkToDoc(c)));
  if (extraEntries.length) ms.addAll(extraEntries.map(e => ({ ...e, keywords_joined: e.keywords.join(' ') })));
  return ms;
}

export function buildIndexFromEntries(entries: RawIndexEntry[]): MiniSearch {
  const ms = makeMiniSearch();
  ms.addAll(entries.map(e => ({
    id: e.id,
    page_title: e.page_title,
    section_title: e.section_title,
    keywords_joined: e.keywords.join(' '),
    content: e.content,
    type: e.type,
    library: e.library,
  })));
  return ms;
}

export interface SearchResult {
  id: string;
  score: number;
}

export function searchIndex(
  index: MiniSearch,
  query: string,
  limit = 10,
): SearchResult[] {
  const raw = index.search(query, { boost: BOOST, prefix: true, fuzzy: 0.2 });
  return raw.slice(0, limit).map((r) => ({ id: r.id as string, score: r.score }));
}

export function serializeIndex(index: MiniSearch): string {
  return JSON.stringify(index);
}

export function deserializeIndex(json: string): MiniSearch {
  return MiniSearch.loadJSON(json, {
    fields: FIELDS,
    storeFields: STORE_FIELDS,
    searchOptions: {
      boost: BOOST,
      prefix: true,
      fuzzy: 0.2,
    },
  });
}
