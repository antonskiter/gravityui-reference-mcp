import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Root, Heading, Paragraph, Text } from "mdast";
import type { PageType } from "../types.js";

export interface ParseResult {
  title: string;
  description: string;
  cleanMarkdown: string;
  headings: { depth: number; text: string }[];
}

/**
 * Strip MDX-specific content from raw MDX/markdown:
 * - import statements
 * - export statements
 * - JSX component tags (self-closing and paired)
 */
function stripMdx(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let insideJsx = false;
  let jsxDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip import statements
    if (/^import\s+/.test(trimmed)) {
      continue;
    }

    // Skip export statements
    if (/^export\s+/.test(trimmed)) {
      continue;
    }

    // Detect JSX opening tags (lines starting with < followed by uppercase or known tags)
    // These are JSX component tags like <Banner>, <ExampleBlock code="...">, etc.
    if (/^<[A-Z][A-Za-z]*[\s/>]/.test(trimmed) || /^<[A-Z][A-Za-z]*>/.test(trimmed)) {
      // Count open/close tags to handle multi-line JSX blocks
      const openTags = (line.match(/<[A-Z][A-Za-z]*[\s>]/g) || []).length;
      const closeTags = (line.match(/<\/[A-Z][A-Za-z]*>/g) || []).length;
      const selfClose = (line.match(/<[A-Z][A-Za-z]*[^>]*\/>/g) || []).length;

      if (selfClose > 0 && openTags <= selfClose + closeTags) {
        // Self-closing or balanced on same line — skip
        continue;
      }

      if (openTags > closeTags) {
        insideJsx = true;
        jsxDepth = openTags - closeTags;
        continue;
      }

      continue;
    }

    if (insideJsx) {
      const openTags = (line.match(/<[A-Z][A-Za-z]*[\s>]/g) || []).length;
      const closeTags = (line.match(/<\/[A-Z][A-Za-z]*>/g) || []).length;
      jsxDepth += openTags - closeTags;
      if (jsxDepth <= 0) {
        insideJsx = false;
        jsxDepth = 0;
      }
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

function parseMarkdown(content: string): Root {
  const processor = unified().use(remarkParse);
  return processor.parse(content) as Root;
}

function extractTitle(tree: Root): string | null {
  let title: string | null = null;
  visit(tree, "heading", (node: Heading) => {
    if (title === null && node.depth === 1) {
      title = mdastToString(node);
    }
  });
  return title;
}

/**
 * Extract the first substantive description paragraph.
 * Skip: badges (lines containing ![), install instructions, empty paragraphs.
 * Truncate to ~80 characters at a word boundary.
 */
function extractDescription(tree: Root): string {
  let foundH1 = false;
  let description = "";

  for (const node of tree.children) {
    if (node.type === "heading" && (node as Heading).depth === 1) {
      foundH1 = true;
      continue;
    }

    // Only look for description after h1
    if (!foundH1) continue;

    // Skip headings after h1
    if (node.type === "heading") continue;

    // Skip code blocks
    if (node.type === "code") continue;

    // Skip HTML nodes
    if (node.type === "html") continue;

    if (node.type === "paragraph") {
      const text = mdastToString(node as Paragraph);

      // Skip empty paragraphs
      if (!text.trim()) continue;

      // Skip badge/image paragraphs
      if (text.includes("![") || /^\[!\[/.test(text)) continue;

      // Skip install instruction paragraphs
      if (/\bnpm install\b/i.test(text)) continue;
      if (/\byarn add\b/i.test(text)) continue;
      if (/\bpnpm add\b/i.test(text)) continue;

      // Check if any inline child is an image (badge detection)
      const hasBadge = (node as Paragraph).children.some(
        (child) => child.type === "image" || child.type === "link"
      );

      // If all children are badges/links and no real text, skip
      const textContent = (node as Paragraph).children
        .filter((child) => child.type === "text")
        .map((child) => (child as Text).value)
        .join("")
        .trim();

      if (hasBadge && !textContent) continue;

      description = text;
      break;
    }
  }

  // Truncate to ~80 chars at word boundary
  if (description.length > 80) {
    const truncated = description.slice(0, 80);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 60) {
      description = truncated.slice(0, lastSpace) + "…";
    } else {
      description = truncated + "…";
    }
  }

  return description;
}

function extractHeadings(tree: Root): { depth: number; text: string }[] {
  const headings: { depth: number; text: string }[] = [];
  visit(tree, "heading", (node: Heading) => {
    if (node.depth === 2 || node.depth === 3) {
      headings.push({ depth: node.depth, text: mdastToString(node) });
    }
  });
  return headings;
}

export function parsePage(
  rawContent: string,
  pageType: PageType,
  name: string,
): ParseResult {
  const cleanMarkdown = stripMdx(rawContent);
  const tree = parseMarkdown(cleanMarkdown);

  const title = extractTitle(tree) ?? name;
  const description = extractDescription(tree);
  const headings = extractHeadings(tree);

  return { title, description, cleanMarkdown, headings };
}
