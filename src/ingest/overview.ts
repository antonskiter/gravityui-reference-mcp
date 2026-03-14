import type { Page, Chunk, DesignSystemOverview, LibraryOverviewEntry, SystemOverview } from "../types.js";
import { sanitize } from "../server/format.js";

function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastPeriod = truncated.lastIndexOf(". ");
  const lastExcl = truncated.lastIndexOf("! ");
  const boundary = Math.max(lastPeriod, lastExcl);
  if (boundary > maxLen * 0.5) {
    return truncated.slice(0, boundary + 1);
  }
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + "…" : truncated + "…";
}

const GUIDE_MAPPING: { pageId: string; field: keyof SystemOverview }[] = [
  { pageId: "guide:Basics", field: "description" },
  { pageId: "guide:Color", field: "theming" },
  { pageId: "guide:Module", field: "spacing" },
  { pageId: "guide:Typography", field: "typography" },
  { pageId: "guide:CornerRadius", field: "corner_radius" },
  { pageId: "guide:Branding", field: "branding" },
];

function buildSystemOverview(
  pages: Page[],
  chunks: Chunk[],
): SystemOverview {
  const pageById = new Map(pages.map(p => [p.id, p]));
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) ?? [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  const system: SystemOverview = {
    description: "",
    theming: "",
    spacing: "",
    typography: "",
    corner_radius: "",
    branding: "",
  };

  for (const { pageId, field } of GUIDE_MAPPING) {
    const page = pageById.get(pageId);
    if (!page) {
      console.warn(`Overview: guide page not found: ${pageId} — skipping`);
      continue;
    }
    const pageChunks = chunksByPageId.get(pageId) ?? [];
    if (pageChunks.length === 0) {
      console.warn(`Overview: no chunks for guide page: ${pageId} — skipping`);
      continue;
    }
    system[field] = truncateAtSentence(pageChunks[0].content, 300);
  }

  return system;
}

function parsePeerDeps(chunks: Chunk[]): string[] {
  const installChunk = chunks.find(c =>
    c.section_title.toLowerCase() === "install"
  );
  if (!installChunk) return [];

  const allText = installChunk.content + " " + installChunk.code_examples.join(" ");
  const matches = allText.match(/@gravity-ui\/[\w-]+/g) ?? [];
  const deps = new Set<string>();
  for (const match of matches) {
    const libName = match.replace("@gravity-ui/", "");
    deps.add(libName);
  }
  return [...deps];
}

function buildLibraryEntries(
  pages: Page[],
  chunks: Chunk[],
): LibraryOverviewEntry[] {
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) ?? [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  const componentCounts = new Map<string, number>();
  for (const page of pages) {
    if (page.page_type === "component" && page.library) {
      componentCounts.set(page.library, (componentCounts.get(page.library) ?? 0) + 1);
    }
  }

  const forwardDeps = new Map<string, string[]>();
  const libraryPages = pages.filter(p => p.page_type === "library");

  for (const page of libraryPages) {
    const lib = page.library ?? page.id.replace("library:", "");
    const pageChunks = chunksByPageId.get(page.id) ?? [];
    const deps = parsePeerDeps(pageChunks).filter(d => d !== lib);
    forwardDeps.set(lib, deps);
  }

  const reverseDeps = new Map<string, string[]>();
  for (const [lib, deps] of forwardDeps) {
    for (const dep of deps) {
      const list = reverseDeps.get(dep) ?? [];
      list.push(lib);
      reverseDeps.set(dep, list);
    }
  }

  const allLibIds = new Set<string>();
  for (const page of pages) {
    if (page.library) allLibIds.add(page.library);
  }

  const entries: LibraryOverviewEntry[] = [];
  for (const lib of [...allLibIds].sort()) {
    const libPage = pages.find(p => p.page_type === "library" && p.library === lib);
    const purpose = libPage
      ? truncateAtSentence(sanitize(libPage.description || libPage.title), 200)
      : "";

    entries.push({
      id: lib,
      package: `@gravity-ui/${lib}`,
      purpose,
      component_count: componentCounts.get(lib) ?? 0,
      depends_on: forwardDeps.get(lib) ?? [],
      is_peer_dependency_of: reverseDeps.get(lib) ?? [],
    });
  }

  return entries;
}

export function generateOverview(pages: Page[], chunks: Chunk[]): DesignSystemOverview {
  return {
    system: buildSystemOverview(pages, chunks),
    libraries: buildLibraryEntries(pages, chunks),
  };
}
