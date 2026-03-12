import MiniSearch from "minisearch";
import type { Chunk } from "../types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FIELDS = ["page_title", "section_title", "keywords_joined", "content"];
const STORE_FIELDS = ["id"];
const BOOST = { page_title: 3, section_title: 2, keywords_joined: 2, content: 1 };

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface IndexDocument {
  id: string;
  page_title: string;
  section_title: string;
  keywords_joined: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkToDoc(chunk: Chunk): IndexDocument {
  return {
    id: chunk.id,
    page_title: chunk.page_title,
    section_title: chunk.section_title,
    keywords_joined: chunk.keywords.join(" "),
    content: chunk.content,
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

export function buildIndex(chunks: Chunk[]): MiniSearch {
  const ms = makeMiniSearch();
  ms.addAll(chunks.map(chunkToDoc));
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
