import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { discover } from "./discover.js";
import { fetchAllPages } from "./fetch.js";

const DATA_DIR = join(process.cwd(), "data");

async function run() {
  console.log("=== Gravity UI Docs — Fetch ===\n");
  mkdirSync(DATA_DIR, { recursive: true });

  const { manifest, commits } = await discover();
  const rawPages = await fetchAllPages(manifest);
  writeFileSync(
    join(DATA_DIR, "raw-pages.json"),
    JSON.stringify({ commits, pages: rawPages }, null, 2),
  );
  console.log(`\nDone — ${rawPages.length} pages saved to data/raw-pages.json`);
}

run().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
