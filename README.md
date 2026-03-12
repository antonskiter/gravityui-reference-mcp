# gravityui-reference-mcp

An MCP server that provides searchable access to [Gravity UI](https://gravity-ui.com) documentation — components, design guides, and API references from `uikit`, `components`, `date-components`, and `navigation` libraries.

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

## Scripts

| Script | Description |
|--------|-------------|
| `npm run serve` | Start the MCP server |
| `npm run ingest` | Re-ingest docs from GitHub |
| `npm run build` | Compile TypeScript |
| `npm test` | Run tests |
| `npm run test-queries` | Run example queries against the server |
