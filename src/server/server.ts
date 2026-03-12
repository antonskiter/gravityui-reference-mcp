import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadData } from "./loader.js";
import { handleSearchDocs } from "./tools/search-docs.js";
import { handleGetSection } from "./tools/get-section.js";
import { handleGetPage } from "./tools/get-page.js";
import { handleListComponents } from "./tools/list-components.js";
import { handleListSources } from "./tools/list-sources.js";

const data = loadData();
console.error(`Loaded ${data.pages.length} pages, ${data.chunks.length} chunks`);

const server = new McpServer({ name: "gravityui-docs", version: "0.1.0" });

server.tool(
  "search_docs",
  "Search Gravity UI documentation by keyword or question. Returns ranked snippets with section IDs for drill-down. Use this as the first step for any documentation question. Call get_section afterward to retrieve full content. Prefer specific terms over vague queries. Do not call more than 3 times per question.",
  {
    query: z.string().describe("The search query or question"),
    limit: z.number().int().min(1).max(10).optional().describe("Maximum number of results to return (1-10)"),
    page_type: z.enum(["component", "guide", "overview"]).optional().describe("Filter results by page type"),
    library: z.string().optional().describe("Filter results by library name"),
  },
  (args) => {
    const result = handleSearchDocs(data, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_section",
  "Retrieve the full content of a documentation section by its ID. Use this after search_docs to get complete text and code examples. Do not call this without first searching — use the section_id from search results.",
  {
    section_id: z.string().describe("The section ID from search results"),
  },
  (args) => {
    const result = handleGetSection(data, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_page",
  "Get the full structure of a documentation page — metadata and a table of contents with section summaries. Use this when you need to understand what a component or guide covers before drilling into specific sections. Do not use this for search — use search_docs instead.",
  {
    page_id: z.string().describe("The page ID to retrieve"),
  },
  (args) => {
    const result = handleGetPage(data, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "list_components",
  "List all available components, optionally filtered by library. Use this for discovery — to see what components exist before searching. Returns names, short descriptions, and IDs only.",
  {
    library: z.string().optional().describe("Filter components by library name"),
  },
  (args) => {
    const result = handleListComponents(data, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "list_sources",
  "Show what documentation is indexed: libraries, page counts, and freshness. Call this once at the start of a session to understand available coverage.",
  {},
  () => {
    const result = handleListSources(data);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
