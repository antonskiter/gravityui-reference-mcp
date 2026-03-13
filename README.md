# gravityui-reference-mcp

An MCP server that provides searchable access to [Gravity UI](https://gravity-ui.com) documentation — components, design guides, and API references from all 34 Gravity UI libraries.

Pre-ingested data is included in the repo, so the server works offline with no setup beyond `npm install`.

## Tools

| Tool | Description |
|------|-------------|
| `list_sources` | Show indexed libraries, page counts, and freshness |
| `list_components` | List all components (optionally filtered by library) |
| `search_docs` | Full-text search across all documentation |
| `get_page` | Get page structure and table of contents |
| `get_section` | Get full content of a specific section |

## Setup

```bash
npm install
```

## Usage

### Local setup

1. **Clone and install**

   ```bash
   git clone https://github.com/antonskiter/gravityui-reference-mcp.git
   cd gravityui-reference-mcp
   npm install
   ```

2. **Verify the server starts**

   ```bash
   npm run serve
   ```

   You should see no errors — the server communicates over stdio and waits for MCP messages.
   Press `Ctrl+C` to stop it.

### With Claude Code

Register the server globally (available in all projects):

```bash
claude mcp add gravityui-docs -s user -- npx tsx /absolute/path/to/gravityui-reference-mcp/src/server/server.ts
```

Or for a single project only:

```bash
claude mcp add gravityui-docs -- npx tsx /absolute/path/to/gravityui-reference-mcp/src/server/server.ts
```

Verify the connection:

```bash
claude mcp list
# gravityui-docs: ... - ✓ Connected
```

> **Important:** Use the absolute path to `src/server/server.ts`. The `claude mcp add` CLI does not support `cwd`, so relative paths won't work.

### With Cursor

Create or edit `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "gravityui-docs": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/gravityui-reference-mcp/src/server/server.ts"]
    }
  }
}
```

Then restart Cursor or reload the MCP servers from **Cursor Settings > MCP**. The server should appear with a green status indicator.

### Test it

Ask your AI assistant something like:

> What Gravity UI components are available for date picking?

It should use the `search_docs` or `list_components` tools to answer from the indexed documentation.

### Standalone (stdio)

```bash
npm run serve
```

The server communicates over stdio using the MCP protocol.

## Re-ingesting data

To refresh the documentation from the Gravity UI GitHub repos:

```bash
npm run ingest
```

This works without any configuration. To avoid GitHub API rate limits on frequent re-ingests, you can optionally provide a token:

```bash
GITHUB_TOKEN=ghp_... npm run ingest
```

## Gravity UI Libraries

All libraries available at [gravity-ui.com/libraries](https://gravity-ui.com/libraries):

| Library | URL |
|---------|-----|
| UIKit | https://gravity-ui.com/libraries/uikit |
| Components | https://gravity-ui.com/libraries/components |
| Date Components | https://gravity-ui.com/libraries/date-components |
| Navigation | https://gravity-ui.com/libraries/navigation |
| Markdown Editor | https://gravity-ui.com/libraries/markdown-editor |
| AIKit | https://gravity-ui.com/libraries/aikit |
| Graph | https://gravity-ui.com/libraries/graph |
| Icons | https://gravity-ui.com/libraries/icons |
| Illustrations | https://gravity-ui.com/libraries/illustrations |
| Dynamic Forms | https://gravity-ui.com/libraries/dynamic-forms |
| Page Constructor | https://gravity-ui.com/libraries/page-constructor |
| Blog Constructor | https://gravity-ui.com/libraries/blog-constructor |
| ChartKit | https://gravity-ui.com/libraries/chartkit |
| Charts | https://gravity-ui.com/libraries/charts |
| Table | https://gravity-ui.com/libraries/table |
| DashKit | https://gravity-ui.com/libraries/dashkit |
| Yagr | https://gravity-ui.com/libraries/yagr |
| Timeline | https://gravity-ui.com/libraries/timeline |
| NodeKit | https://gravity-ui.com/libraries/nodekit |
| ExpressKit | https://gravity-ui.com/libraries/expresskit |
| App Layout | https://gravity-ui.com/libraries/app-layout |
| Date Utils | https://gravity-ui.com/libraries/date-utils |
| Axios Wrapper | https://gravity-ui.com/libraries/axios-wrapper |
| Dialog Fields | https://gravity-ui.com/libraries/dialog-fields |
| I18n | https://gravity-ui.com/libraries/i18n |
| Data Source | https://gravity-ui.com/libraries/data-source |
| Page Constructor Builder | https://gravity-ui.com/libraries/page-constructor-builder |
| ESLint Config | https://gravity-ui.com/libraries/eslint-config |
| TSconfig | https://gravity-ui.com/libraries/tsconfig |
| Prettier Config | https://gravity-ui.com/libraries/prettier-config |
| Stylelint Config | https://gravity-ui.com/libraries/stylelint-config |
| Babel Preset | https://gravity-ui.com/libraries/babel-preset |
| Browserslist Config | https://gravity-ui.com/libraries/browserslist-config |
| Webpack i18n Plugin | https://gravity-ui.com/libraries/webpack-i18n-assets-plugin |

> All libraries above are indexed by this MCP server.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run serve` | Start the MCP server |
| `npm run ingest` | Re-ingest docs from GitHub |
| `npm run build` | Compile TypeScript |
| `npm test` | Run tests |
| `npm run test-queries` | Run example queries against the server |
