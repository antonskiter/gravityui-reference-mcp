import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deserializeIndex } from "../ingest/index.js";
import type { Page, Chunk, IngestMetadata } from "../types.js";
import type MiniSearch from "minisearch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "..", "..", "data");

export interface LoadedData {
  pages: Page[];
  chunks: Chunk[];
  metadata: IngestMetadata;
  index: MiniSearch;
  pageById: Map<string, Page>;
  chunkById: Map<string, Chunk>;
  chunksByPageId: Map<string, Chunk[]>;
}

export function loadData(): LoadedData {
  const pages: Page[] = JSON.parse(readFileSync(join(DATA_DIR, "pages.json"), "utf-8"));
  const chunks: Chunk[] = JSON.parse(readFileSync(join(DATA_DIR, "chunks.json"), "utf-8"));
  const metadata: IngestMetadata = JSON.parse(readFileSync(join(DATA_DIR, "metadata.json"), "utf-8"));
  const indexJson = readFileSync(join(DATA_DIR, "search-index.json"), "utf-8");
  const index = deserializeIndex(indexJson);

  const pageById = new Map(pages.map(p => [p.id, p]));
  const chunkById = new Map(chunks.map(c => [c.id, c]));
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) || [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  return { pages, chunks, metadata, index, pageById, chunkById, chunksByPageId };
}
