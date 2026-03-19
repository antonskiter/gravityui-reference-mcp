# gravityui-reference-mcp

An MCP (Model Context Protocol) server providing AI-optimized access to the [Gravity UI](https://gravity-ui.com) design system — 34 libraries, 1351 entities, 19 recipes. Pre-ingested data is included, so the server works offline with no setup beyond `pnpm install`.

## Tools

The server exposes 3 tools:

**find** — Search by intent across all entity types. Describe what you need in plain language.

- `query` (required) — e.g. "date picker", "sidebar navigation", "toast notification"
- `type` (optional) — filter by entity type: "component", "hook", "utility", "asset", "token-set", "config-doc", "guide"

**get** — Deep dive into one entity, recipe, or the system overview.

- `name` (required) — entity name ("Button"), recipe id ("confirmation-dialog"), or "overview"
- `detail` (optional) — "compact" (default) or "full"

**list** — Browse entities with orthogonal filters.

- `type` (optional) — "component", "hook", "utility", "asset", "config-doc", "guide", "token-set"
- `category` (optional) — "actions", "ai", "data-display", "feedback", "forms", "layout", "navigation", "overlays", "typography", "utility"
- `library` (optional) — e.g. "uikit", "aikit", "navigation"

## Setup

```bash
pnpm install
```

## Usage

### Local setup

1. Clone and install:

   ```bash
   git clone https://github.com/antonskiter/gravityui-reference-mcp.git
   cd gravityui-reference-mcp
   pnpm install
   ```

2. Verify the server starts:

   ```bash
   pnpm serve
   ```

   Press `Ctrl+C` to stop. The server communicates over stdio.

### With Claude Code

Register globally:

```bash
claude mcp add gravityui-docs -s user -- npx tsx /absolute/path/to/gravityui-reference-mcp/src/server/server.ts
```

Or per-project:

```bash
claude mcp add gravityui-docs -- npx tsx /absolute/path/to/gravityui-reference-mcp/src/server/server.ts
```

Verify:

```bash
claude mcp list
# gravityui-docs: ... - Connected
```

> Use the absolute path to `src/server/server.ts`.

### With Cursor

Create `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` globally):

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

Restart Cursor or reload MCP servers from Settings > MCP.

### Try it

Ask your AI assistant:

> I need a date range picker for a booking form

It will use `find` to discover DatePicker, then `get` to retrieve props and examples.

## Data Pipeline

Three-step pipeline for updating data from vendor submodules:

```bash
pnpm run update-submodules   # pull latest vendor/ sources
pnpm run extract             # per-library LLM extraction -> data/entities/*.json
pnpm run overview            # ecosystem overview + categories -> data/overview.json
pnpm run validate            # Zod schema + cross-reference checks
```

## Data Model

All public-facing things in the ecosystem are **entities** with a unified schema:

- **component** — React components with props, examples, import statements
- **hook** — React hooks with signature, parameters, return type
- **utility** — Functions, classes, constants
- **asset** — Icons and illustrations
- **token-set** — Design tokens (spacing, breakpoints)
- **config-doc** — Shared configs (eslint, tsconfig, prettier)
- **guide** — Conceptual documentation (i18n-react, nodekit overview)

Plus **recipes** — hand-maintained UI patterns (confirmation dialog, dashboard layout, form validation, etc.).

## Scripts

- `pnpm serve` — Start the MCP server (stdio, dev mode)
- `pnpm build` — Compile TypeScript
- `pnpm test` — Run tests (Vitest)
- `pnpm test:watch` — Watch mode
- `pnpm run extract` — Per-library LLM entity extraction
- `pnpm run overview` — Generate ecosystem overview
- `pnpm run validate` — Validate data with Zod schemas
- `pnpm run update-submodules` — Update vendor git submodules

## License

MIT. Documentation in `data/` is sourced from [Gravity UI](https://github.com/gravity-ui) repositories (MIT licensed).
