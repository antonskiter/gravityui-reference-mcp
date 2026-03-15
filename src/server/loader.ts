import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deserializeIndex } from "../ingest/index.js";
import type { Page, Chunk, IngestMetadata, ComponentTags, DesignSystemOverview, ComponentDef, TokenSet, CategoryMap } from "../types.js";
import type MiniSearch from "minisearch";

export type { DesignSystemOverview } from "../types.js";

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
  tagsByPageId: Map<string, string[]>;
  overview: DesignSystemOverview;
  componentDefs: ComponentDef[];
  componentByName: Map<string, ComponentDef[]>;
  componentsByLibrary: Map<string, ComponentDef[]>;
  tokens: TokenSet;
  categoryMap: CategoryMap;
}

export function loadData(): LoadedData {
  const pages: Page[] = JSON.parse(readFileSync(join(DATA_DIR, "pages.json"), "utf-8"));
  const chunks: Chunk[] = JSON.parse(readFileSync(join(DATA_DIR, "chunks.json"), "utf-8"));
  const metadata: IngestMetadata = JSON.parse(readFileSync(join(DATA_DIR, "metadata.json"), "utf-8"));
  const indexJson = readFileSync(join(DATA_DIR, "search-index.json"), "utf-8");
  const index = deserializeIndex(indexJson);
  const tagsRaw: ComponentTags = JSON.parse(readFileSync(join(DATA_DIR, "tags.json"), "utf-8"));
  const overview: DesignSystemOverview = JSON.parse(readFileSync(join(DATA_DIR, "overview.json"), "utf-8"));

  const pageById = new Map(pages.map(p => [p.id, p]));
  const chunkById = new Map(chunks.map(c => [c.id, c]));
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) || [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  const tagsByPageId = new Map(Object.entries(tagsRaw));

  // Load new extraction data (graceful fallback if not yet extracted)
  const componentsPath = join(DATA_DIR, "components.json");
  const componentDefs: ComponentDef[] = existsSync(componentsPath)
    ? JSON.parse(readFileSync(componentsPath, "utf-8"))
    : [];
  const tokensPath = join(DATA_DIR, "tokens.json");
  const tokens: TokenSet = existsSync(tokensPath)
    ? JSON.parse(readFileSync(tokensPath, "utf-8"))
    : { spacing: {}, breakpoints: {}, sizes: {} };
  const categoriesPath = join(DATA_DIR, "categories.json");
  const categoryMap: CategoryMap = existsSync(categoriesPath)
    ? JSON.parse(readFileSync(categoriesPath, "utf-8"))
    : { categories: {}, components: {} };

  // Build lookup maps
  const componentByName = new Map<string, ComponentDef[]>();
  for (const comp of componentDefs) {
    const list = componentByName.get(comp.name) || [];
    list.push(comp);
    componentByName.set(comp.name, list);
  }
  const componentsByLibrary = new Map<string, ComponentDef[]>();
  for (const comp of componentDefs) {
    const list = componentsByLibrary.get(comp.library) || [];
    list.push(comp);
    componentsByLibrary.set(comp.library, list);
  }

  return { pages, chunks, metadata, index, pageById, chunkById, chunksByPageId, tagsByPageId, overview, componentDefs, componentByName, componentsByLibrary, tokens, categoryMap };
}
