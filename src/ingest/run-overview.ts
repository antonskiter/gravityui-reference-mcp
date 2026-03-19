// src/ingest/run-overview.ts
async function main() {
  console.log('Dispatch one Opus agent with:');
  console.log('  Prompt: src/ingest/prompts/overview.md');
  console.log('  Task: read all data/entities/*.json, update _system.json and add category fields to component entities');
  console.log('  Output 1: data/entities/_system.json (updated Gravity UI system entity)');
  console.log('  Output 2: data/entities/{lib}.json (component entities with category field added)');
}

main().catch(console.error);
