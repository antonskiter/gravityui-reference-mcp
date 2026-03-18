import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadData } from "./loader.js";
import { handleFind, formatFind } from "./tools/find.js";
import { handleGet, formatGet } from "./tools/get.js";
import { handleList, formatList } from "./tools/list.js";

const data = loadData();

const server = new McpServer({ name: "gravityui-docs", version: "1.0.0" });

// Tool 1: get
server.tool(
  "get",
  "Look up a Gravity UI component, recipe, library, design tokens, or system overview by name or ID. Examples: get('Button'), get('data-table'), get('uikit'), get('spacing'), get('overview')",
  {
    topic: z.string().describe("Component name (PascalCase), recipe ID (kebab-case), library ID, token topic (spacing|colors|breakpoints|sizes|typography), or 'overview'"),
  },
  (args) => {
    const result = handleGet(data, { name: args.topic });
    return { content: [{ type: "text", text: formatGet(result, "full") }] };
  },
);

// Tool 2: find
server.tool(
  "find",
  "Search across all Gravity UI components, recipes, and docs by keyword or phrase. Returns ranked results. Examples: find('table sorting'), find('dark theme'), find('file upload')",
  {
    query: z.string().describe("Search query — keywords, phrases, or component/recipe names"),
  },
  (args) => {
    const result = handleFind(data, args);
    return { content: [{ type: "text", text: formatFind(result) }] };
  },
);

// Tool 3: list
server.tool(
  "list",
  "List available Gravity UI components, recipes, hooks, assets, utilities, config packages, or all 32 libraries grouped by category. Examples: list(), list({type:'library'}), list({type:'hook',library:'uikit'}), list({type:'asset'}), list({scope:'recipes'})",
  {
    scope: z.enum(["components", "recipes", "all"]).optional().describe("What to list (default: all)"),
    library: z.string().optional().describe("Filter by library id (e.g. i18n, icons, uikit)"),
    level: z.enum(["atom", "molecule", "organism", "page", "foundation"]).optional().describe("Filter recipes by level"),
    type: z.enum(["component", "hook", "api-function", "asset", "token", "config-package", "library"]).optional().describe("Filter by entity type"),
  },
  (args) => {
    const { scope, library, level, type } = args;
    // Map new schema to handleList's expected input
    const what = scope === "all" || !scope ? undefined : scope as "components" | "recipes";
    const filter = (!type && !library) ? level : undefined;
    const result = handleList(data, { what, filter, type, library });
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
