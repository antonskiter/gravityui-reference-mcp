import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadData } from "./loader.js";
import { handleSearchDocs, formatSearchDocs } from "./tools/search-docs.js";
import { handleGetSection, formatGetSection } from "./tools/get-section.js";
import { handleGetPage, formatGetPage } from "./tools/get-page.js";
import { handleListComponents, formatListComponents } from "./tools/list-components.js";
import { handleListSources, formatListSources } from "./tools/list-sources.js";
import { handleSuggestComponent, formatSuggestComponent } from "./tools/suggest-component.js";
import { handleGetComponentReference, formatGetComponentReference } from "./tools/get-component-reference.js";
import { handleGetQuickStart, formatGetQuickStart } from "./tools/get-quick-start.js";
import { handleGetDesignSystemOverview, formatGetDesignSystemOverview } from "./tools/get-design-system-overview.js";

const data = loadData();
console.error(`Loaded ${data.pages.length} pages, ${data.chunks.length} chunks`);

const server = new McpServer({ name: "gravityui-docs", version: "0.1.0" });

server.tool(
  "search_docs",
  "Search Gravity UI documentation by keyword or question. Best suited for planning and research — for coding tasks, prefer suggest_component or get_component_reference instead. Returns ranked snippets with section IDs for drill-down. Call get_section afterward to retrieve full content. Prefer specific terms over vague queries. Do not call more than 3 times per question.",
  {
    query: z.string().describe("The search query or question"),
    limit: z.number().int().min(1).max(10).optional().describe("Maximum number of results to return (1-10)"),
    page_type: z.enum(["component", "guide", "library"]).optional().describe("Filter results by page type"),
    library: z.string().optional().describe("Filter results by library name"),
  },
  (args) => {
    const result = handleSearchDocs(data, args);
    return { content: [{ type: "text", text: formatSearchDocs(result) }] };
  },
);

server.tool(
  "get_section",
  "Retrieve the full content of a documentation section by its ID. Best suited for planning and research — for coding tasks, prefer get_component_reference with detail='full' instead. Use this after search_docs to get complete text and code examples. Do not call this without first searching — use the section_id from search results.",
  {
    section_id: z.string().describe("The section ID from search results"),
  },
  (args) => {
    const result = handleGetSection(data, args);
    return { content: [{ type: "text", text: formatGetSection(result) }] };
  },
);

server.tool(
  "get_page",
  "Get the full structure of a documentation page — metadata and a table of contents with section summaries. Best suited for planning and research — for coding tasks, prefer get_component_reference instead. Use this when you need to understand what a component or guide covers before drilling into specific sections.",
  {
    page_id: z.string().describe("The page ID to retrieve"),
  },
  (args) => {
    const result = handleGetPage(data, args);
    return { content: [{ type: "text", text: formatGetPage(result) }] };
  },
);

server.tool(
  "list_components",
  "List all available components, optionally filtered by library. Best suited for planning and research — for coding tasks, prefer suggest_component or get_quick_start instead. Returns names, short descriptions, and IDs only.",
  {
    library: z.string().optional().describe("Filter components by library name"),
  },
  (args) => {
    const result = handleListComponents(data, args);
    return { content: [{ type: "text", text: formatListComponents(result) }] };
  },
);

server.tool(
  "list_sources",
  "Show what documentation is indexed: libraries, page counts, and freshness. Best suited for planning and research — for coding tasks, prefer get_design_system_overview instead. Call this once at the start of a session to understand available coverage.",
  {},
  () => {
    const result = handleListSources(data);
    return { content: [{ type: "text", text: formatListSources(result) }] };
  },
);

server.tool(
  "suggest_component",
  "Suggest Gravity UI components for a described use case. Returns ranked suggestions based on semantic tag matching. Use this when you know what you need but not which component provides it.",
  {
    use_case: z.string().describe("Describe what you need, e.g. 'date range selection' or 'sidebar navigation'"),
    library: z.string().optional().describe("Filter suggestions to a specific library"),
    limit: z.number().int().min(1).max(5).optional().describe("Maximum number of suggestions (1-5, default 3)"),
  },
  (args) => {
    const result = handleSuggestComponent(data, args);
    return { content: [{ type: "text", text: formatSuggestComponent(result) }] };
  },
);

server.tool(
  "get_component_reference",
  "Get a complete reference for a Gravity UI component in a single call. Returns import statement, props, code example, and optionally full documentation. Use this when you know which component you need and want to start coding.",
  {
    name: z.string().describe("Component name, e.g. 'Button', 'Select', 'DatePicker'"),
    library: z.string().describe("Library name, e.g. 'uikit', 'date-components'"),
    detail: z.enum(["compact", "full"]).optional().describe("Level of detail: 'compact' (default) for props + example, 'full' for everything"),
  },
  (args) => {
    const result = handleGetComponentReference(data, args);
    return { content: [{ type: "text", text: formatGetComponentReference(result) }] };
  },
);

server.tool(
  "get_quick_start",
  "Get everything needed to start using a Gravity UI library: install command, setup code, and a list of available components. Use this when you've decided which library to use and need to set it up.",
  {
    library: z.string().describe("Library name, e.g. 'uikit', 'navigation', 'date-components'"),
  },
  (args) => {
    const result = handleGetQuickStart(data, args);
    return { content: [{ type: "text", text: formatGetQuickStart(result) }] };
  },
);

server.tool(
  "get_design_system_overview",
  "Get the Gravity UI design system philosophy and library overview. Returns theming model, color system, spacing conventions, and per-library purpose with dependency relationships. Call this once at the start of a session to understand the design system before building with it.",
  {
    library: z.string().optional().describe("Optional: filter to show only this library's entry alongside the system overview"),
  },
  (args) => {
    const result = handleGetDesignSystemOverview(data, args);
    return { content: [{ type: "text", text: formatGetDesignSystemOverview(result) }] };
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
