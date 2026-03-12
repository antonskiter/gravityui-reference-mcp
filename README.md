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

### With Claude Code

Add to your Claude Code MCP config (`~/.claude/claude_desktop_config.json` or project-level `.mcp.json`):

```json
{
  "mcpServers": {
    "gravityui-docs": {
      "command": "npx",
      "args": ["tsx", "src/server/server.ts"],
      "cwd": "/path/to/gravityui-reference-mcp"
    }
  }
}
```

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
