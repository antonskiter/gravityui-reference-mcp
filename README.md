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

### With Cursor

Add to your Cursor MCP config (`.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally):

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

Then restart Cursor or reload the MCP servers from **Cursor Settings > MCP**.

### Local setup step-by-step

1. **Clone and install**

   ```bash
   git clone https://github.com/<your-org>/gravityui-reference-mcp.git
   cd gravityui-reference-mcp
   npm install
   ```

2. **Verify the server starts**

   ```bash
   npm run serve
   ```

   You should see no errors — the server communicates over stdio and waits for MCP messages.
   Press `Ctrl+C` to stop it.

3. **Register in Claude Code** — add the server to your project-level `.mcp.json` (recommended) or to `~/.claude/claude_desktop_config.json`:

   ```bash
   # From the project where you want Gravity UI docs available:
   claude mcp add gravityui-docs -- npx tsx /absolute/path/to/gravityui-reference-mcp/src/server/server.ts
   ```

   Or manually create/edit `.mcp.json` at the root of your project:

   ```json
   {
     "mcpServers": {
       "gravityui-docs": {
         "command": "npx",
         "args": ["tsx", "src/server/server.ts"],
         "cwd": "/absolute/path/to/gravityui-reference-mcp"
       }
     }
   }
   ```

4. **Register in Cursor** — create or edit `.cursor/mcp.json` at the root of your project (or `~/.cursor/mcp.json` globally):

   ```json
   {
     "mcpServers": {
       "gravityui-docs": {
         "command": "npx",
         "args": ["tsx", "src/server/server.ts"],
         "cwd": "/absolute/path/to/gravityui-reference-mcp"
       }
     }
   }
   ```

   Then open **Cursor Settings > MCP** and verify the server appears with a green status indicator.

5. **Test** — ask your AI assistant something like:

   > What Gravity UI components are available for date picking?

   It should use the `search_docs` or `list_components` tools to answer from the indexed documentation.

> **Tip:** Replace `/absolute/path/to/gravityui-reference-mcp` with the actual path where you cloned the repo. The `cwd` field is required so the server can find the pre-ingested data.

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
