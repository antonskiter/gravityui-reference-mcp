import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePage } from "./parse.js";
import { chunkPage } from "./chunk.js";
import { buildIndex, serializeIndex } from "./index.js";
import { generateAllTags } from "./tags.js";
import { generateOverview } from "./overview.js";
import type { Page, Chunk, IngestMetadata, RawPage } from "../types.js";

const DATA_DIR = join(process.cwd(), "data");

function run() {
  console.log("=== Gravity UI Docs — Build ===\n");

  // Load cached raw pages
  const rawPath = join(DATA_DIR, "raw-pages.json");
  const rawData = JSON.parse(readFileSync(rawPath, "utf-8"));
  const rawPages: RawPage[] = rawData.pages;
  const commits: Record<string, string> = rawData.commits;
  console.log(`Loaded ${rawPages.length} raw pages from data/raw-pages.json`);

  // Parse → Chunk
  console.log("Parsing and chunking...");
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
  console.log(`  ${pages.length} pages → ${allChunks.length} chunks`);

  // Tags & overview
  console.log("Generating tags and overview...");
  const tags = generateAllTags(pages, allChunks);
  writeFileSync(join(DATA_DIR, "tags.json"), JSON.stringify(tags, null, 2));

  const overview = generateOverview(pages, allChunks);
  writeFileSync(join(DATA_DIR, "overview.json"), JSON.stringify(overview, null, 2));
  console.log(`  ${Object.keys(tags).length} tagged components, ${overview.libraries.length} libraries`);

  // Search index
  console.log("Building search index...");
  const index = buildIndex(allChunks);
  writeFileSync(join(DATA_DIR, "search-index.json"), serializeIndex(index));

  const metadata: IngestMetadata = {
    indexed_at: new Date().toISOString(),
    source_commits: commits,
  };
  writeFileSync(join(DATA_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));

  console.log(`\nDone — ${pages.length} pages, ${allChunks.length} chunks indexed`);
}

run();
