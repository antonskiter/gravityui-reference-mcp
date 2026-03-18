// src/ingest/run-overview.ts
async function main() {
  console.log('Dispatch one Opus agent with:');
  console.log('  Prompt: src/ingest/prompts/overview.md');
  console.log('  Task: read all data/entities/*.json, produce overview');
  console.log('  Output: data/overview.json');
}

main().catch(console.error);
