import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadData } from "./loader.js";
import { handleFind, formatFind } from "./tools/find.js";
import { handleGet, formatGet } from "./tools/get.js";
import { handleList, formatList } from "./tools/list.js";

const data = loadData();
console.error(`Loaded: ${data.pages.length} pages, ${data.chunks.length} chunks, ${data.componentDefs.length} components, ${data.recipes.length} recipes`);

const server = new McpServer({ name: "gravityui-docs", version: "1.0.0" });

// Tool 1: find
server.tool(
  "find",
  "Find the right Gravity UI components, patterns, or recipes for your use case. Describe what you need in plain language. Returns compact cards you can expand with get().",
  {
    query: z.string().describe("Describe what you need, e.g. 'confirmation dialog before delete' or 'table with sorting and pagination'"),
  },
  (args) => {
    const result = handleFind(data, args);
    return { content: [{ type: "text", text: formatFind(result) }] };
  },
);

// Tool 2: get
server.tool(
  "get",
  "Get full details for a component, recipe, token topic, or library by name. Use component names like 'Button', recipe IDs like 'confirmation-dialog', token topics like 'spacing', or 'overview' for the design system summary.",
  {
    name: z.string().describe("Component name (e.g. 'Button'), recipe ID (e.g. 'confirmation-dialog'), token topic (e.g. 'spacing'), library ID (e.g. 'uikit'), or 'overview'"),
    detail: z.enum(["compact", "full"]).optional().describe("'compact' (default): summary. 'full': all sections, examples, and props"),
  },
  (args) => {
    const result = handleGet(data, args);
    return { content: [{ type: "text", text: formatGet(result, args.detail) }] };
  },
);

// Tool 3: list
server.tool(
  "list",
  "Browse what Gravity UI offers. No arguments returns a table of contents. Filter by type: 'components', 'recipes', 'libraries', 'tokens'. Add a second argument to narrow: list('components', 'forms') or list('recipes', 'organism').",
  {
    what: z.enum(["components", "recipes", "libraries", "tokens"]).optional().describe("What to list. Omit for table of contents."),
    filter: z.string().optional().describe("Narrow results: category slug for components, library ID for components, level for recipes"),
  },
  (args) => {
    const result = handleList(data, args);
    return { content: [{ type: "text", text: formatList(result) }] };
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
