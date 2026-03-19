// src/server/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadData } from './loader.js';
import { handleFind, formatFind } from './tools/find.js';
import { handleGet, formatGet } from './tools/get.js';
import { handleList, formatList } from './tools/list.js';

const data = loadData();

const server = new McpServer({ name: 'gravityui-docs', version: '2.0.0' });

server.tool(
  'find',
  'Search GravityUI components, hooks, tokens, assets, recipes by intent. Use when you need to discover what exists.',
  { query: z.string().describe('What you are looking for, e.g. "date picker", "sidebar navigation", "form validation"'),
    type: z.string().optional().describe('Filter by entity type: component, hook, token-set, asset, utility, config-doc, guide') },
  (args) => {
    try {
      const result = handleFind(data, { query: args.query, type: args.type });
      return { content: [{ type: 'text', text: formatFind(result) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e}` }], isError: true };
    }
  },
);

server.tool(
  'get',
  'Get detailed info about a specific component, hook, recipe, or "overview" for the whole design system. Use after find.',
  { name: z.string().describe('Entity name (e.g. "Button", "useTheme"), recipe id (e.g. "confirmation-dialog"), or "overview"'),
    detail: z.enum(['compact', 'full']).optional().describe('Level of detail. compact (default) = top props + 1 example. full = everything.') },
  (args) => {
    try {
      const result = handleGet(data, { name: args.name, detail: args.detail ?? 'compact' });
      return { content: [{ type: 'text', text: formatGet(result, args.detail ?? 'compact') }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e}` }], isError: true };
    }
  },
);

server.tool(
  'list',
  'Browse the GravityUI ecosystem. No filters = summary. Add filters to narrow down.',
  { type: z.string().optional().describe('Entity type: component, hook, token-set, asset, utility, config-doc, guide'),
    category: z.string().optional().describe('Component category: actions, forms, layout, navigation, feedback, overlays, data-display, typography, utility, ai'),
    library: z.string().optional().describe('Library id: uikit, navigation, date-components, etc.') },
  (args) => {
    try {
      const result = handleList(data, { type: args.type, category: args.category, library: args.library });
      return { content: [{ type: 'text', text: formatList(result) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
