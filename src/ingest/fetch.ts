import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PageManifestEntry, RawPage } from "../types.js";

const DELAY_MS = 100;
const DATA_DIR = join(process.cwd(), "data");

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  maxRetries = 3,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers: getHeaders() });
    if (res.ok) {
      return res.text();
    }
    if (res.status === 429 || res.status === 403) {
      const resetHeader = res.headers.get("x-ratelimit-reset");
      const waitMs = resetHeader
        ? Math.max(0, Number(resetHeader) * 1000 - Date.now()) + 1000
        : Math.pow(2, attempt + 1) * 1000;
      console.warn(
        `Rate limited on ${url}, waiting ${Math.round(waitMs / 1000)}s...`,
      );
      await delay(waitMs);
      continue;
    }
    console.warn(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    return null;
  }
  return null;
}

function loadCachedPages(): Map<string, string> {
  const cachePath = join(DATA_DIR, "raw-pages.json");
  if (!existsSync(cachePath)) return new Map();
  try {
    const data = JSON.parse(readFileSync(cachePath, "utf-8"));
    const map = new Map<string, string>();
    for (const page of data.pages || []) {
      map.set(page.url, page.content);
    }
    console.log(`Loaded ${map.size} cached pages as fallback`);
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchAllPages(
  manifest: PageManifestEntry[],
): Promise<RawPage[]> {
  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "Warning: GITHUB_TOKEN not set. Rate limit is 60 req/hr. Set GITHUB_TOKEN for 5000 req/hr.",
    );
  }

  const cache = loadCachedPages();
  const pages: RawPage[] = [];
  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    console.log(
      `Fetching [${i + 1}/${manifest.length}] ${entry.page_type}:${entry.name}`,
    );
    let content = await fetchWithRetry(entry.raw_url);
    if (!content && cache.has(entry.raw_url)) {
      console.warn(`  Using cached version for ${entry.name}`);
      content = cache.get(entry.raw_url)!;
    }
    if (content) {
      pages.push({
        url: entry.raw_url,
        github_url: entry.github_url,
        content,
        page_type: entry.page_type,
        library: entry.library,
        name: entry.name,
      });
    }
    await delay(DELAY_MS);
  }
  console.log(`Fetched ${pages.length}/${manifest.length} pages successfully`);
  return pages;
}
