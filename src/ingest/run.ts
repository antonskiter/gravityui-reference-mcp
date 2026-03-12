import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { discover } from "./discover.js";
import { fetchAllPages } from "./fetch.js";
import { parsePage } from "./parse.js";
import { chunkPage } from "./chunk.js";
import { buildIndex, serializeIndex } from "./index.js";
import type { Page, Chunk, IngestMetadata } from "../types.js";

const DATA_DIR = join(process.cwd(), "data");

async function run() {
  console.log("=== Gravity UI Docs Ingest Pipeline ===\n");
  mkdirSync(DATA_DIR, { recursive: true });

  // Stage 1: Discover → Fetch
  console.log("Stage 1: Discovering and fetching pages...");
  const { manifest, commits } = await discover();
  const rawPages = await fetchAllPages(manifest);
  writeFileSync(
    join(DATA_DIR, "raw-pages.json"),
    JSON.stringify({ commits, pages: rawPages }, null, 2),
  );
  console.log(`  Fetched ${rawPages.length} raw pages`);

  // Stage 2: Parse → Chunk
  console.log("Stage 2: Parsing and chunking pages...");
  const pages: Page[] = [];
  const allChunks: Chunk[] = [];

  for (const raw of rawPages) {
    const parsed = parsePage(raw.content, raw.page_type, raw.name);
    const { page_id, chunks } = chunkPage(parsed, raw.page_type, raw.name, raw.library);

    pages.push({
      id: page_id,
      title: parsed.title,
      page_type: raw.page_type,
      library: raw.library,
      url: chunks[0]?.url || "",
      github_url: raw.github_url,
      breadcrumbs: chunks[0]?.breadcrumbs || [],
      description: parsed.description,
      section_ids: chunks.map((c) => c.id),
    });

    allChunks.push(...chunks);
  }

  writeFileSync(join(DATA_DIR, "pages.json"), JSON.stringify(pages, null, 2));
  writeFileSync(join(DATA_DIR, "chunks.json"), JSON.stringify(allChunks, null, 2));
  console.log(`  Parsed ${pages.length} pages into ${allChunks.length} chunks`);

  // Stage 3: Index
  console.log("Stage 3: Building search index...");
  const index = buildIndex(allChunks);
  writeFileSync(join(DATA_DIR, "search-index.json"), serializeIndex(index));

  const metadata: IngestMetadata = {
    indexed_at: new Date().toISOString(),
    source_commits: commits,
  };
  writeFileSync(join(DATA_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));
  console.log("  Search index written");

  console.log("\n=== Ingest Complete ===");
  console.log(`  Pages: ${pages.length}, Chunks: ${allChunks.length}`);
}

run().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
