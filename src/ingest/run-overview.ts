// src/ingest/run-overview.ts
//
// Overview update — new unified model (no overview.json)
//
// The overview data is embedded directly in data/entities/_system.json (the
// Gravity UI system entity) and in each per-library JSON file as a `category`
// field on component entities.
//
// To regenerate / update overview data, dispatch one Opus agent with:
//
//   Prompt : src/ingest/prompts/overview.md
//   Inputs : data/entities/*.json  (read-only)
//   Output 1: data/entities/_system.json
//             → Update the `overview` field with fresh library / category counts
//               and the top-level summary of the Gravity UI design system.
//   Output 2: data/entities/{lib}.json  (one file per library)
//             → For every entity of type "component", ensure the `category`
//               field is set to the appropriate UI category string
//               (e.g. "Navigation", "Data Display", "Feedback", …).
//
// No standalone overview file is written. All data lives in the entity files
// that are already consumed by the MCP server.

async function main() {
  console.log('Overview update instructions:');
  console.log('');
  console.log('There is no overview.json. Overview data lives in:');
  console.log('  1. data/entities/_system.json  — system-level summary + library counts');
  console.log('  2. data/entities/{lib}.json    — component entities with `category` field');
  console.log('');
  console.log('To update, dispatch an Opus agent with prompt src/ingest/prompts/overview.md');
  console.log('that reads all data/entities/*.json and writes the two outputs above.');
}

main().catch(console.error);
