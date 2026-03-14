import type { LoadedData } from "../loader.js";
import { codeBlock } from "../format.js";

export interface GetQuickStartInput {
  library: string;
}

interface QuickStartComponent {
  name: string;
  description: string;
  page_id: string;
}

export interface GetQuickStartOutput {
  library: string;
  package: string;
  install?: string;
  peer_dependencies?: string;
  setup_code?: string;
  description: string;
  components: QuickStartComponent[];
  url: string;
  github_url?: string;
}

export interface GetQuickStartError {
  error: string;
}

const USAGE_TITLES = ["usage", "getting started", "get started"];

export function handleGetQuickStart(
  data: LoadedData,
  input: GetQuickStartInput,
): GetQuickStartOutput | GetQuickStartError {
  const { library } = input;
  const pageId = `library:${library}`;
  const page = data.pageById.get(pageId);

  if (!page) {
    return { error: `Library not found: ${library}` };
  }

  const chunks = data.chunksByPageId.get(page.id) ?? [];

  // Install chunk
  const installChunk = chunks.find(c =>
    c.section_title.toLowerCase() === "install"
  );

  // Usage chunk
  const usageChunk = chunks.find(c =>
    USAGE_TITLES.includes(c.section_title.toLowerCase())
  );

  // Components for this library
  const components: QuickStartComponent[] = data.pages
    .filter(p => p.page_type === "component" && p.library === library)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(p => ({
      name: p.title,
      description: p.description,
      page_id: p.id,
    }));

  const result: GetQuickStartOutput = {
    library,
    package: `@gravity-ui/${library}`,
    description: page.description || page.title,
    components,
    url: page.url,
    github_url: page.github_url,
  };

  if (installChunk) {
    const firstCode = installChunk.code_examples[0];
    if (firstCode) result.install = firstCode;

    const secondCode = installChunk.code_examples[1];
    if (secondCode) result.peer_dependencies = secondCode;
  }

  if (usageChunk) {
    const firstCode = usageChunk.code_examples[0];
    if (firstCode) result.setup_code = firstCode;
  }

  return result;
}

export function formatGetQuickStart(result: GetQuickStartOutput | GetQuickStartError): string {
  if ("error" in result) return `Error: ${result.error}`;

  const lines: string[] = [
    `## ${result.library} (${result.package})`,
    result.description,
  ];

  if (result.install) {
    lines.push("", "### Install", codeBlock("bash", result.install));
  }

  if (result.peer_dependencies) {
    lines.push("", "### Peer Dependencies", codeBlock("bash", result.peer_dependencies));
  }

  if (result.setup_code) {
    lines.push("", "### Setup", codeBlock("tsx", result.setup_code));
  }

  lines.push("", `### Components (${result.components.length})`);
  for (const c of result.components) {
    lines.push(`- **${c.name}** (\`${c.page_id}\`) — ${c.description}`);
  }

  return lines.join("\n");
}
