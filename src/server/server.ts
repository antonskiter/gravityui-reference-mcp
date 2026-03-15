import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadData } from "./loader.js";
import { handleSearchDocs, formatSearchDocs } from "./tools/search-docs.js";
import { handleListComponents, formatListComponents } from "./tools/list-components.js";
import { handleSuggestComponent, formatSuggestComponent } from "./tools/suggest-component.js";
import { handleGetComponent, formatGetComponent } from "./tools/get-component.js";
import { handleGetDesignTokens, formatGetDesignTokens } from "./tools/get-design-tokens.js";

const data = loadData();
console.error(`Loaded ${data.pages.length} pages, ${data.chunks.length} chunks, ${data.componentDefs.length} components`);

const server = new McpServer({ name: "gravityui-docs", version: "0.2.0" });

// Tool 1: list_components
server.tool(
  "list_components",
  "Browse available Gravity UI components grouped by category. Use when you need to discover what components exist. Filter by library or category for focused results.",
  {
    library: z.string().optional().describe("Filter to a specific library (e.g. 'uikit', 'components')"),
    category: z.string().optional().describe("Filter to a category (e.g. 'layout', 'forms', 'actions', 'feedback', 'navigation', 'overlays', 'data-display', 'typography', 'utility')"),
  },
  (args) => {
    const result = handleListComponents(data, args);
    return { content: [{ type: "text", text: formatListComponents(result) }] };
  },
);

// Tool 2: suggest_component
server.tool(
  "suggest_component",
  "Find the right Gravity UI component for a use case. Describe what you need in plain language. Use this when you know WHAT you want to build but not WHICH component to use.",
  {
    use_case: z.string().describe("Describe what you need, e.g. 'dropdown with search' or 'sidebar navigation'"),
    library: z.string().optional().describe("Filter suggestions to a specific library"),
    limit: z.number().int().min(1).max(5).optional().describe("Maximum number of suggestions (1-5, default 3)"),
  },
  (args) => {
    const result = handleSuggestComponent(data, args);
    return { content: [{ type: "text", text: formatSuggestComponent(result) }] };
  },
);

// Tool 3: get_component
server.tool(
  "get_component",
  "Get the complete API reference for a Gravity UI component: import statement, TypeScript props interface, and code example. Use this when you know WHICH component you need and want to write code with it.",
  {
    name: z.string().describe("Component name, e.g. 'Button', 'Select', 'Flex'"),
    library: z.string().optional().describe("Library name if component exists in multiple libraries"),
    detail: z.enum(["compact", "full"]).optional().describe("'compact' (default): top 20 props. 'full': all props and examples"),
  },
  (args) => {
    const result = handleGetComponent(data, args);
    return { content: [{ type: "text", text: formatGetComponent(result, args.detail) }] };
  },
);

// Tool 4: search_docs
server.tool(
  "search_docs",
  "Search Gravity UI documentation for behavioral questions, guides, and usage patterns. Use when you need to understand HOW something works, not WHAT component to use.",
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

// Tool 5: get_design_tokens
server.tool(
  "get_design_tokens",
  "Get Gravity UI design tokens: spacing scale, breakpoints, component size heights. Use when you need exact values for gap, padding, media queries, or component sizing.",
  {
    topic: z.enum(["spacing", "breakpoints", "sizes", "colors"]).optional().describe("Get only a specific token category"),
  },
  (args) => {
    const result = handleGetDesignTokens(data, args);
    return { content: [{ type: "text", text: formatGetDesignTokens(result) }] };
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
