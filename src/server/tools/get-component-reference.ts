import type { LoadedData } from "../loader.js";
import { codeBlock, indent } from "../format.js";

export interface GetComponentReferenceInput {
  name: string;
  library: string;
  detail?: "compact" | "full";
}

interface SectionEntry {
  title: string;
  content: string;
  code_examples: string[];
}

interface GuideEntry {
  title: string;
  content: string;
}

export interface GetComponentReferenceOutput {
  component: string;
  library: string;
  import_statement: string;
  description: string;
  props?: string;
  example?: string;
  design_guide_sections: string[];
  url: string;
  github_url?: string;
  // Full mode only
  all_sections?: SectionEntry[];
  design_guide?: GuideEntry[];
  css_api?: string;
}

export interface GetComponentReferenceError {
  error: string;
}

const PROPS_TITLES = ["properties", "props", "api"];
const CSS_API_TITLE = "css api";

export function handleGetComponentReference(
  data: LoadedData,
  input: GetComponentReferenceInput,
): GetComponentReferenceOutput | GetComponentReferenceError {
  const { name, library, detail = "compact" } = input;
  const pageId = `component:${library}:${name}`;
  const page = data.pageById.get(pageId);

  if (!page) {
    return { error: `Component not found: ${name} in ${library}` };
  }

  const chunks = data.chunksByPageId.get(page.id) ?? [];

  // Import statement
  const import_statement = `import {${page.title}} from '@gravity-ui/${library}';`;

  // Props: find chunk with matching section title
  const propsChunk = chunks.find(c =>
    PROPS_TITLES.includes(c.section_title.toLowerCase())
  );

  // Example: first non-empty code example from intro chunk
  const introChunk = chunks[0];
  const firstExample = introChunk?.code_examples?.find(e => e.length > 0);

  // Design guide sections
  const guidePageId = `guide:${page.title}`;
  const guidePage = data.pageById.get(guidePageId);
  const design_guide_sections = guidePage?.section_ids ?? [];

  const result: GetComponentReferenceOutput = {
    component: page.title,
    library: library,
    import_statement,
    description: page.description,
    design_guide_sections,
    url: page.url,
    github_url: page.github_url,
  };

  if (propsChunk) {
    result.props = propsChunk.content;
  }

  if (firstExample) {
    result.example = firstExample;
  }

  // Full mode
  if (detail === "full") {
    result.all_sections = chunks.map(c => ({
      title: c.section_title,
      content: c.content,
      code_examples: c.code_examples,
    }));

    // Design guide content
    if (guidePage) {
      const guideChunks = data.chunksByPageId.get(guidePage.id) ?? [];
      result.design_guide = guideChunks.map(c => ({
        title: c.section_title,
        content: c.content,
      }));
    } else {
      result.design_guide = [];
    }

    // CSS API
    const cssChunk = chunks.find(c =>
      c.section_title.toLowerCase() === CSS_API_TITLE
    );
    if (cssChunk) {
      result.css_api = cssChunk.content;
    }
  }

  return result;
}

export function formatGetComponentReference(result: GetComponentReferenceOutput | GetComponentReferenceError): string {
  if ("error" in result) return `Error: ${result.error}`;

  const lines: string[] = [
    `${result.component} (@gravity-ui/${result.library})`,
    result.description,
    "",
    codeBlock("ts", result.import_statement),
  ];

  if (result.props) {
    lines.push("", "Props:", indent(result.props));
  }

  if (result.example) {
    lines.push("", "Example:", codeBlock("tsx", result.example));
  }

  if (result.design_guide_sections.length > 0) {
    lines.push("", `Design guide sections: ${result.design_guide_sections.join(", ")}`);
  }

  const urlLine = result.github_url ? `${result.url} | ${result.github_url}` : result.url;
  lines.push("", urlLine);

  // Full mode extras
  if (result.all_sections && result.all_sections.length > 0) {
    lines.push("", "All Sections:");
    for (const s of result.all_sections) {
      lines.push("", `${s.title}:`, indent(s.content));
      for (const code of s.code_examples) {
        lines.push(codeBlock("tsx", code));
      }
    }
  }

  if (result.design_guide && result.design_guide.length > 0) {
    lines.push("", "Design Guide:");
    for (const g of result.design_guide) {
      lines.push("", `${g.title}:`, indent(g.content));
    }
  }

  if (result.css_api) {
    lines.push("", "CSS API:", indent(result.css_api));
  }

  return lines.join("\n");
}
