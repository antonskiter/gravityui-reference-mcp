import type { Chunk, PageType } from "../types.js";
import type { ParseResult } from "./parse.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a heading text to a URL-friendly slug. */
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

/** Build a stable chunk ID. */
function makeChunkId(
  pageType: PageType,
  name: string,
  slug: string,
  library?: string,
): string {
  if (pageType === "component" && library) {
    return `component:${library}:${name}:${slug}`;
  }
  if (pageType === "library" && library) {
    return `library:${library}:${slug}`;
  }
  return `guide:${name}:${slug}`;
}

/** Build a stable page ID. */
function makePageId(pageType: PageType, name: string, library?: string): string {
  if (pageType === "component" && library) {
    return `component:${library}:${name}`;
  }
  if (pageType === "library" && library) {
    // Sub-doc pages have name !== library (e.g., "markdown-editor/docs/getting-started")
    if (name !== library) {
      return `library:${library}:${name}`;
    }
    return `library:${library}`;
  }
  return `guide:${name}`;
}

/** Build a canonical gravity-ui.com URL. */
function makeCanonicalUrl(
  pageType: PageType,
  name: string,
  library?: string,
): string {
  if (pageType === "component" && library) {
    return `https://gravity-ui.com/components/${library}/${toSlug(name)}`;
  }
  if (pageType === "library" && library) {
    return `https://gravity-ui.com/libraries/${library}`;
  }
  return `https://gravity-ui.com/design/guides?sectionId=guides&articleId=${name.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Code block extraction
// ---------------------------------------------------------------------------

interface ExtractedContent {
  content: string;
  codeExamples: string[];
}

/** Remove fenced code blocks from markdown, returning them separately. */
function extractCodeBlocks(text: string): ExtractedContent {
  const codeExamples: string[] = [];
  const content = text.replace(/```[\s\S]*?```/g, (match) => {
    // Strip the fence lines, keep only the code body
    const lines = match.split("\n");
    // Remove opening ``` line and closing ``` line
    const codeLines = lines.slice(1, lines.length - 1);
    codeExamples.push(codeLines.join("\n").trim());
    return "";
  });

  return { content: content.trim(), codeExamples };
}

// ---------------------------------------------------------------------------
// Keyword extraction
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "of", "to", "for",
  "with", "on", "at", "by", "is", "it", "its", "be", "as",
  "are", "was", "were", "that", "this", "from", "up", "how",
]);

function extractKeywords(
  name: string,
  sectionTitle: string,
  library?: string,
): string[] {
  const keywords: string[] = [];

  // Component/page name (preserve casing)
  keywords.push(name);

  // Library name
  if (library) {
    keywords.push(library);
  }

  // Words from the section title, lower-cased, stop-words filtered
  const titleWords = sectionTitle
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  keywords.push(...titleWords);

  // Deduplicate while preserving order
  return [...new Set(keywords)];
}

// ---------------------------------------------------------------------------
// Markdown section splitting
// ---------------------------------------------------------------------------

interface Section {
  title: string;
  body: string; // includes the heading line and content
}

/**
 * Split clean markdown at h2 boundaries.
 * h3 lines stay inside the h2 buffer (they are not used as section breaks here).
 * The intro section before the first h2 is given the page title as its title.
 */
function splitIntoSections(markdown: string, pageTitle: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];

  let currentTitle = pageTitle;
  let buffer: string[] = [];

  for (const line of lines) {
    // h2 boundary
    if (/^## /.test(line)) {
      if (buffer.length > 0) {
        sections.push({ title: currentTitle, body: buffer.join("\n").trim() });
      }
      currentTitle = line.replace(/^## /, "").trim();
      buffer = [line];
      continue;
    }

    // h1 — set the running title but don't start a new section
    if (/^# /.test(line)) {
      buffer.push(line);
      continue;
    }

    // h3 and everything else goes into the current buffer
    buffer.push(line);
  }

  // Flush last buffer
  if (buffer.length > 0) {
    sections.push({ title: currentTitle, body: buffer.join("\n").trim() });
  }

  return sections.filter((s) => s.body.trim().length > 0);
}

/**
 * Split a large section at h3 boundaries.
 */
function splitSectionByH3(section: Section): Section[] {
  const lines = section.body.split("\n");
  const subsections: Section[] = [];

  let currentTitle = section.title;
  let buffer: string[] = [];

  for (const line of lines) {
    if (/^### /.test(line)) {
      if (buffer.length > 0) {
        subsections.push({ title: currentTitle, body: buffer.join("\n").trim() });
      }
      currentTitle = line.replace(/^### /, "").trim();
      buffer = [line];
      continue;
    }
    buffer.push(line);
  }

  if (buffer.length > 0) {
    subsections.push({ title: currentTitle, body: buffer.join("\n").trim() });
  }

  // Filter out empty/whitespace-only subsections
  return subsections.filter((s) => s.body.replace(/^###.*/, "").trim().length > 0);
}

// ---------------------------------------------------------------------------
// Main chunker
// ---------------------------------------------------------------------------

export function chunkPage(
  parsed: ParseResult,
  pageType: PageType,
  name: string,
  library?: string,
): { page_id: string; chunks: Chunk[] } {
  const page_id = makePageId(pageType, name, library);
  const canonicalUrl = makeCanonicalUrl(pageType, name, library);

  const rawSections = splitIntoSections(parsed.cleanMarkdown, parsed.title);

  // Expand large h2 sections by splitting at h3
  const sections: Section[] = [];
  for (const section of rawSections) {
    if (section.body.length > 3000) {
      const subsections = splitSectionByH3(section);
      if (subsections.length > 1) {
        sections.push(...subsections);
        continue;
      }
    }
    sections.push(section);
  }

  // Slug deduplication map
  const slugCounts = new Map<string, number>();

  const chunks: Chunk[] = [];

  for (const section of sections) {
    const baseSlug = toSlug(section.title);
    const count = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, count);
    const slug = count === 1 ? baseSlug : `${baseSlug}-${count}`;

    const chunkId = makeChunkId(pageType, name, slug, library);
    const { content, codeExamples } = extractCodeBlocks(section.body);
    const keywords = extractKeywords(name, section.title, library);

    // Breadcrumbs: page title > section title (skip if same)
    const breadcrumbs =
      section.title === parsed.title
        ? [parsed.title]
        : [parsed.title, section.title];

    chunks.push({
      id: chunkId,
      page_id,
      url: canonicalUrl,
      page_title: parsed.title,
      page_type: pageType,
      library,
      section_title: section.title,
      breadcrumbs,
      content,
      code_examples: codeExamples,
      keywords,
    });
  }

  return { page_id, chunks };
}
